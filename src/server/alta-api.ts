import "server-only";

import { buscarParecidos, palabrasDeNombre } from "~/lib/nombres";
import { crearAlumno, invitarFamilia, perdonarMora } from "./alumnos";
import { proveedorParecido } from "./correo-salud";
import { db } from "./db";
import { MAX_RESPONSABLES, linkRegistroAlumno } from "./dominio";
import { dominioRecibe } from "./entrega";
import { permitirRafaga } from "./limite-intentos";
import { credencialesDeGrupo } from "./talo";

/**
 * El alta de alumnos que hace un sistema de afuera: el bot de WhatsApp.
 *
 * Es el mismo botón "Agregar alumno" del panel, con tres diferencias que salen
 * de que del otro lado no hay una persona mirando la lista del curso:
 *
 * - **Los repetidos frenan.** En el panel el aviso de nombre parecido se puede
 *   pasar por alto porque el que carga sabe quién es quién. Acá el bot tiene
 *   que preguntarle a la familia y volver a pedir.
 * - **El email se revisa antes de crear nada.** Una familia que escribe por
 *   WhatsApp tipea rápido, y un "gmial.com" es una invitación que no llega y
 *   un rebote que le resta reputación al dominio.
 * - **La mora de lo ya vencido se perdona sola.** Corrió mientras el alumno no
 *   existía en el sistema y la familia no tenía cómo pagar. En el panel eso lo
 *   decide el admin cuota por cuota; acá no hay a quién preguntarle, y cobrar
 *   un recargo de bienvenida es peor que perdonarlo de más. Se puede volver a
 *   cobrar desde la ficha del alumno.
 *
 * Todas las respuestas traen `mensaje` en castellano, escrito para que el bot
 * lo pueda leer sin traducir códigos, y `error` o `estado` estables para que
 * decida qué hacer.
 */

export type Respuesta = { status: number; cuerpo: Record<string, unknown> };

const error = (status: number, codigo: string, mensaje: string, extra = {}) => ({
  status,
  cuerpo: { error: codigo, mensaje, ...extra },
});

/** Cuántas altas nuevas por hora deja hacer la API. Lo ya cargado no cuenta. */
export const ALTAS_POR_HORA = 60;

/* ----------------------------------------------------------- el catálogo */

function etiquetaDe(colegio: string, curso: string) {
  return colegio.trim().toLowerCase() === curso.trim().toLowerCase()
    ? colegio
    : `${colegio} · ${curso}`;
}

/**
 * Los cursos en los que el bot puede dar de alta.
 *
 * Son los mismos en los que una familia se puede registrar sola por el link:
 * egresados, con el registro abierto y con una cuenta que cobre. Si el admin
 * cerró el registro de un curso, el bot tampoco entra.
 *
 * Los de prueba salen sólo si se piden, marcados: sirven para ensayar la
 * conexión sin crear CVUs de verdad, y no tienen que aparecerle a una familia.
 */
export async function cursosParaAlta(opciones: { incluirPrueba: boolean }) {
  const grupos = await db.grupo.findMany({
    where: {
      tipo: "EGRESADOS",
      autoRegistro: true,
      ...(opciones.incluirPrueba ? {} : { modoPrueba: false }),
    },
    select: {
      id: true,
      nombre: true,
      subtitulo: true,
      modoPrueba: true,
      colegio: { select: { nombre: true } },
    },
  });

  const conCuenta = await Promise.all(
    grupos.map(async (g) => ((await credencialesDeGrupo(g.id)) ? g : null)),
  );

  return conCuenta
    .filter((g): g is NonNullable<typeof g> => g !== null)
    .map((g) => {
      const colegio = g.colegio?.nombre ?? g.subtitulo;
      return {
        id: g.id,
        colegio,
        curso: g.nombre,
        etiqueta: etiquetaDe(colegio, g.nombre),
        prueba: g.modoPrueba,
      };
    })
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
}

/* ---------------------------------------------------------------- el alta */

/** Partículas que van en minúscula en un nombre: "Juan de la Cruz". */
const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "da", "di"]);

/**
 * El nombre como se escribe en una lista: espacios de más afuera y, si vino
 * todo en minúscula, con mayúscula inicial.
 *
 * Sólo se toca lo que vino todo en minúscula, que es como se escribe en el
 * celular. Si trae alguna mayúscula, la familia eligió cómo escribirlo y no
 * hay por qué corregirla.
 */
export function prolijarNombre(nombre: string) {
  const limpio = nombre.replace(/\s+/g, " ").trim();
  if (limpio !== limpio.toLowerCase()) return limpio;
  return limpio
    .split(" ")
    .map((p, i) =>
      i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join(" ");
}

/**
 * Las altas de un mismo curso, de a una.
 *
 * Sin esto, dos pedidos iguales que llegan juntos (el bot que reintenta porque
 * Talo tardó) pasan los dos el chequeo de repetidos antes de que el primero
 * escriba, y quedan dos alumnos con dos CVUs. Vive en memoria porque la app
 * corre en un solo proceso; si algún día son varios, esto pasa a ser un
 * candado en la base.
 */
const enCurso = new Map<string, Promise<unknown>>();

async function deAUno<T>(llave: string, trabajo: () => Promise<T>): Promise<T> {
  const anterior = enCurso.get(llave) ?? Promise.resolve();
  const este = anterior.catch(() => undefined).then(trabajo);
  enCurso.set(llave, este);
  try {
    return await este;
  } finally {
    if (enCurso.get(llave) === este) enCurso.delete(llave);
  }
}

/** Qué pasó con la última invitación de un alumno, dicho para el bot. */
async function estadoInvitacion(alumnoId: string) {
  const n = await db.notificacion.findFirst({
    where: { alumnoId, tipo: "INVITACION" },
    orderBy: { creadoEn: "desc" },
  });
  if (!n) {
    return { estado: "no_salio", motivo: "No quedó registrada la invitación." };
  }
  if (n.errorEnvio) return { estado: "no_salio", motivo: n.errorEnvio };
  if (n.enviadoEl) return { estado: "enviada", destinatario: n.destinatario };
  return {
    estado: "en_bandeja",
    destinatario: n.destinatario,
    motivo: "El envío de correos está apagado: la invitación quedó en la bandeja del panel sin salir.",
  };
}

export async function altaDesdeApi(input: {
  /** El id de un curso del catálogo. Por dentro es un grupo. */
  cursoId: string;
  nombre: string;
  email: string;
  /** Crear aunque haya un nombre parecido. Lo manda el bot después de preguntar. */
  forzar?: boolean;
  /** Usar el email aunque parezca mal escrito. También después de preguntar. */
  confirmarEmail?: boolean;
}): Promise<Respuesta> {
  const grupo = await db.grupo.findUnique({
    where: { id: input.cursoId },
    select: {
      id: true,
      nombre: true,
      slug: true,
      subtitulo: true,
      tipo: true,
      autoRegistro: true,
      colegio: { select: { nombre: true } },
      cuotas: { select: { numero: true, venceEl: true } },
    },
  });
  if (!grupo || grupo.tipo !== "EGRESADOS") {
    return error(
      404,
      "curso_no_encontrado",
      "No hay un curso con ese id. Los cursos válidos salen de GET /api/v1/cursos.",
    );
  }
  if (!grupo.autoRegistro) {
    return error(
      409,
      "curso_cerrado",
      "Este curso no acepta altas nuevas: Halley cerró el registro. Hay que hablar con Halley.",
    );
  }
  const curso = {
    id: grupo.id,
    colegio: grupo.colegio?.nombre ?? grupo.subtitulo,
    curso: grupo.nombre,
  };

  const nombre = prolijarNombre(input.nombre);
  if (palabrasDeNombre(nombre).length < 2) {
    return error(
      400,
      "nombre_incompleto",
      "Hace falta el nombre y el apellido del alumno.",
    );
  }

  const email = input.email.trim().toLowerCase();
  const [usuario = "", dominio = ""] = email.split("@");

  const bloqueo = await db.direccionBloqueada.findUnique({ where: { email } });
  if (bloqueo?.motivo === "rebote") {
    return error(
      422,
      "email_rebota",
      `A ${email} ya se le escribió y el correo volvió: no existe o no acepta mensajes. Hace falta otra dirección.`,
    );
  }
  const recibe = await dominioRecibe(dominio);
  const parecido = proveedorParecido(dominio);
  const sugerencia = parecido ? `${usuario}@${parecido}` : null;
  if (recibe === false) {
    return error(
      422,
      "email_no_recibe",
      sugerencia
        ? `El dominio ${dominio} no recibe correo. ¿Quisiste decir ${sugerencia}?`
        : `El dominio ${dominio} no recibe correo. Seguramente está mal escrito.`,
      { sugerencia },
    );
  }
  if (sugerencia && !input.confirmarEmail) {
    return error(
      422,
      "email_dudoso",
      `${email} parece mal escrito. ¿Quisiste decir ${sugerencia}? Si está bien, mandalo de nuevo con confirmarEmail: true.`,
      { sugerencia },
    );
  }

  return deAUno(grupo.id, async () => {
    const alumnos = await db.alumno.findMany({
      where: { grupoId: grupo.id },
      select: {
        id: true,
        nombre: true,
        emailContacto: true,
        _count: { select: { tutores: true } },
      },
    });
    const parecidos = buscarParecidos(nombre, email, alumnos);

    // El mismo nombre: ya está. Si tiene el mismo email es el bot que
    // reintenta, y se contesta igual que la primera vez.
    const igual =
      parecidos.find((p) => p.parecido === "igual" && p.mismoEmail) ??
      parecidos.find((p) => p.parecido === "igual");
    if (igual) return yaEstaba(igual.alumno, igual.mismoEmail, email, grupo.slug, curso);

    if (!input.forzar && parecidos.length > 0) {
      return error(
        409,
        "posible_repetido",
        "En el curso ya hay un nombre muy parecido. Si es la misma persona, mandalo de nuevo con el nombre exacto de la lista; si no lo es, con forzar: true.",
        {
          candidatos: parecidos.map((p) => ({
            id: p.alumno.id,
            nombre: p.alumno.nombre,
          })),
        },
      );
    }

    if (!permitirRafaga("api:altas", ALTAS_POR_HORA, 3_600_000)) {
      return error(
        429,
        "cupo_de_altas",
        `La API ya dio de alta ${ALTAS_POR_HORA} alumnos en la última hora. Es un freno contra un bot que se descontrola: probá más tarde o cargalo desde el panel.`,
      );
    }

    if (!(await credencialesDeGrupo(grupo.id))) {
      return error(
        503,
        "curso_sin_cuenta",
        "El curso no tiene una cuenta que cobre, y sin ella no se le puede crear el CVU al alumno. Hay que asignarla en el panel.",
      );
    }

    let alta;
    try {
      alta = await crearAlumno({
        grupoId: grupo.id,
        nombre,
        emailContacto: email,
      });
    } catch (e) {
      console.error("[api] no se pudo crear el alumno:", e);
      return error(
        502,
        "no_se_pudo_crear",
        "No se pudo crear el CVU del alumno en Talo, así que no se dio de alta. No quedó nada a medias: se puede volver a intentar.",
      );
    }
    if (alta.yaExistia) {
      return yaEstaba(alta.alumno, false, email, grupo.slug, curso);
    }

    const ahora = Date.now();
    const vencidas = grupo.cuotas
      .filter((c) => c.venceEl.getTime() < ahora)
      .map((c) => c.numero)
      .sort((a, b) => a - b);
    await perdonarMora(alta.alumno.id, grupo.id, vencidas);

    await invitarFamilia(alta.alumno.id);

    return {
      status: 201,
      cuerpo: {
        estado: "creado",
        mensaje: `${nombre} quedó dado de alta en ${etiquetaDe(curso.colegio, curso.curso)}.`,
        alumno: { id: alta.alumno.id, nombre: alta.alumno.nombre },
        curso,
        invitacion: await estadoInvitacion(alta.alumno.id),
        linkRegistro: linkRegistroAlumno(grupo.slug, alta.alumno.id),
        moraPerdonada: vencidas,
      },
    };
  });
}

/**
 * El alumno ya estaba cargado.
 *
 * Si nadie de su familia se registró y el admin lo cargó sin email (la lista
 * del colegio), el email que trae el bot es justo lo que faltaba: se guarda y
 * sale la invitación. Si ya tiene otro email o responsables, no se toca nada:
 * pisar el contacto mandaría los recordatorios a otra casilla. Ahí se devuelve
 * el link de registro, que es el mismo que ya ofrece la página pública del
 * curso, para que la familia se sume como otro responsable.
 */
async function yaEstaba(
  alumno: {
    id: string;
    nombre: string;
    emailContacto: string | null;
    _count?: { tutores: number };
  },
  mismoEmail: boolean,
  email: string,
  slug: string,
  curso: { id: string; colegio: string; curso: string },
): Promise<Respuesta> {
  const responsables =
    alumno._count?.tutores ??
    (await db.tutor.count({ where: { alumnoId: alumno.id } }));

  let invitacion: Record<string, unknown>;
  if (mismoEmail) {
    invitacion = {
      estado: "no_corresponde",
      motivo: "ya_tenia_este_email",
      ultima: await estadoInvitacion(alumno.id),
    };
  } else if (responsables === 0 && !alumno.emailContacto) {
    await invitarFamilia(alumno.id, { email });
    invitacion = await estadoInvitacion(alumno.id);
  } else {
    invitacion = {
      estado: "no_corresponde",
      motivo: responsables > 0 ? "ya_tiene_responsables" : "ya_tiene_otro_email",
    };
  }

  return {
    status: 200,
    cuerpo: {
      estado: "ya_estaba",
      mensaje: `${alumno.nombre} ya estaba cargado en el curso.`,
      alumno: { id: alumno.id, nombre: alumno.nombre },
      curso,
      responsables,
      lugaresLibres: Math.max(0, MAX_RESPONSABLES - responsables),
      invitacion,
      linkRegistro: linkRegistroAlumno(slug, alumno.id),
    },
  };
}
