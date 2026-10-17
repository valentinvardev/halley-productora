import "server-only";

import { TRPCError } from "@trpc/server";

import { normalizarEmail, puedeSumarResponsable } from "./cuentas";
import { db } from "./db";
import { MAX_RESPONSABLES } from "./dominio";

/**
 * Entrar sin link: la tercera puerta de las familias.
 *
 * Las otras dos son el link del correo (producción) y el ingreso directo de la
 * demo. Ésta no es ninguna de las dos: es una excepción de producción, cuenta
 * por cuenta, que el administrador habilita desde la ficha del alumno para la
 * familia que no logra abrir el link. No mira la puerta de la demo (demo.ts)
 * ni AUTH_PADRES, y no se importan acá a propósito: un grep de la función de
 * la demo sobre este archivo tiene que dar cero.
 *
 * Abre sólo lo que esa cuenta ya tiene: sus alumnos vinculados. Nunca suma un
 * alumno nuevo, porque eso es lo que el link prueba y acá nadie probó nada.
 *
 * Y hay una cuarta, por curso (`Grupo.entradaSinEnlace`): el administrador
 * decide que un curso entero entre con sólo el email. Ésa sí suma alumnos
 * nuevos desde el link del grupo, porque eso es exactamente lo que se pidió:
 * que las familias de ese colegio se registren y entren sin confirmar el
 * correo. La contención es la misma que la de por cuenta: cupo por IP en
 * /entrar, cupo de responsables por alumno, sesiones marcadas para poder
 * cerrarlas al apagar, y la puerta a la vista en el curso, en la lista y en
 * Ajustes.
 */

/**
 * ¿Este email entra con sólo escribirlo? Devuelve la cuenta o null.
 *
 * Dos condiciones en una consulta: el admin la habilitó (hay fila en
 * AccesoSinEnlace) y la cuenta sigue siendo responsable de alguien. Con
 * `alumnoId` (registro desde el link del grupo) tiene que ser responsable de
 * ese alumno: la lista abre lo propio, nunca sirve para reclamar un alumno
 * nuevo sin probar el email. Una cuenta que ya no es de nadie queda inerte.
 */
export async function cuentaSinEnlace(email: string, alumnoId?: string) {
  const cuenta = await db.cuenta.findUnique({
    where: { email: normalizarEmail(email) },
    select: {
      id: true,
      accesoSinEnlace: { select: { id: true } },
      _count: { select: { tutorias: { where: alumnoId ? { alumnoId } : {} } } },
    },
  });
  if (!cuenta?.accesoSinEnlace || cuenta._count.tutorias === 0) return null;
  return { cuentaId: cuenta.id };
}

/**
 * ¿Este email entra por su curso? Devuelve el grupo que lo deja, o null.
 *
 * Con `alumnoId` (registro desde el link del grupo) manda el curso de ese
 * alumno: si tiene la entrada sin link, el email entra y queda vinculado,
 * sin probar nada. Sin `alumnoId` (login suelto) entra si ya es responsable de
 * algún alumno de un curso con la puerta abierta. Lo que abre en ese caso es
 * la cuenta entera, con todos sus alumnos: la sesión es de la cuenta, no del
 * curso.
 */
export async function cursoSinEnlace(email: string, alumnoId?: string) {
  if (alumnoId) {
    const alumno = await db.alumno.findUnique({
      where: { id: alumnoId },
      select: { grupo: { select: { id: true, entradaSinEnlace: true } } },
    });
    return alumno?.grupo.entradaSinEnlace ? { grupoId: alumno.grupo.id } : null;
  }
  const tutoria = await db.tutor.findFirst({
    where: {
      cuenta: { email: normalizarEmail(email) },
      alumno: { grupo: { entradaSinEnlace: true } },
    },
    select: { alumno: { select: { grupoId: true } } },
  });
  return tutoria ? { grupoId: tutoria.alumno.grupoId } : null;
}

/**
 * Enciende o apaga la entrada sin link de un curso entero.
 *
 * Apagarla cierra las sesiones que entraron así por este curso: las de
 * cuentas sin excepción propia, responsables de algún alumno del curso y de
 * ningún otro curso que siga abierto. Las que canjearon un link probaron el
 * email y siguen vivas, igual que al quitar la excepción por cuenta.
 */
export async function cambiarEntradaSinEnlaceDelCurso(
  grupoId: string,
  activo: boolean,
) {
  await db.grupo.update({
    where: { id: grupoId },
    data: { entradaSinEnlace: activo },
  });
  if (activo) return { sesionesCerradas: 0 };

  const { count } = await db.sesion.deleteMany({
    where: {
      abiertaSinEnlace: true,
      cuenta: {
        accesoSinEnlace: { is: null },
        tutorias: {
          some: { alumno: { grupoId } },
          none: { alumno: { grupo: { entradaSinEnlace: true } } },
        },
      },
    },
  });
  return { sesionesCerradas: count };
}

/**
 * Cuántas sesiones vivas entraron sin link por este curso. Es el rastro que
 * la fila por cuenta lleva en `usos`; acá se cuenta sobre las sesiones.
 */
export async function contarSesionesSinEnlaceDelCurso(grupoId: string) {
  return db.sesion.count({
    where: {
      abiertaSinEnlace: true,
      expiraEl: { gt: new Date() },
      cuenta: {
        accesoSinEnlace: { is: null },
        tutorias: { some: { alumno: { grupoId } } },
      },
    },
  });
}

/**
 * Deja el rastro. Devuelve si la fila seguía existiendo.
 *
 * updateMany y no update: si Fran quitó la fila entre el chequeo y acá, no
 * puede explotar con la sesión ya creada. Pero tampoco puede callarse: un
 * cero acá quiere decir que la puerta se cerró mientras alguien entraba, y
 * quien llama tiene que deshacer esa sesión, porque ya no habría desde dónde
 * cerrarla.
 *
 * El origen se recorta: viene del encabezado X-Forwarded-For, que un cliente
 * puede escribir a mano, y una columna sin tope es un lugar donde dejar
 * cualquier cosa. Una IPv6 entera entra en 45.
 */
export async function anotarEntradaSinEnlace(cuentaId: string, origen: string) {
  const { count } = await db.accesoSinEnlace.updateMany({
    where: { cuentaId },
    data: {
      usos: { increment: 1 },
      ultimoUsoEl: new Date(),
      ultimoOrigen: origen.slice(0, 64),
    },
  });
  return count > 0;
}

/**
 * Habilita un email para un alumno. Crea la cuenta y el vínculo si faltan:
 * el admin está respondiendo por esa persona.
 */
export async function habilitarSinEnlace(alumnoId: string, emailCrudo: string) {
  const email = normalizarEmail(emailCrudo);
  const permiso = await puedeSumarResponsable(alumnoId, email);
  if (permiso.motivo === "no-existe")
    throw new TRPCError({ code: "NOT_FOUND" });
  if (!permiso.ok) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `${permiso.alumno.nombre} ya tiene ${MAX_RESPONSABLES} responsables. Sacá uno desde Responsables para habilitar otro email.`,
    });
  }

  const cuenta = await db.cuenta.upsert({
    where: { email },
    update: {},
    create: { email },
    include: {
      accesoSinEnlace: true,
      tutorias: { include: { alumno: { select: { id: true, nombre: true } } } },
    },
  });
  // Los booleanos salen de la foto de arriba, para el mensaje de pantalla.
  // Las escrituras van con upsert y no con create: la misma ficha abierta en
  // dos pestañas y dos clics casi a la vez hacían que el segundo cayera con
  // un error de clave única en vez de no hacer nada, que es lo correcto.
  const yaEraResponsable = cuenta.tutorias.some((t) => t.alumnoId === alumnoId);
  if (!yaEraResponsable) {
    await db.tutor.upsert({
      where: { cuentaId_alumnoId: { cuentaId: cuenta.id, alumnoId } },
      update: {},
      create: { cuentaId: cuenta.id, alumnoId },
    });
  }
  const yaEntraba = cuenta.accesoSinEnlace !== null;
  if (!yaEntraba) {
    await db.accesoSinEnlace.upsert({
      where: { cuentaId: cuenta.id },
      update: {},
      create: { cuentaId: cuenta.id },
    });
  }

  return {
    email,
    yaEntraba,
    vinculadoNuevo: !yaEraResponsable,
    otrosAlumnos: cuenta.tutorias
      .filter((t) => t.alumnoId !== alumnoId)
      .map((t) => t.alumno.nombre),
  };
}

/**
 * Quita la excepción y cierra las sesiones que entraron por ella. Las que
 * canjearon un link probaron el email y siguen vivas.
 */
export async function quitarSinEnlace(email: string) {
  const cuenta = await db.cuenta.findUnique({
    where: { email: normalizarEmail(email) },
    select: { id: true },
  });
  if (!cuenta) return { existia: false as const, sesionesCerradas: 0 };
  const [borradas, sesiones] = await db.$transaction([
    db.accesoSinEnlace.deleteMany({ where: { cuentaId: cuenta.id } }),
    db.sesion.deleteMany({
      where: { cuentaId: cuenta.id, abiertaSinEnlace: true },
    }),
  ]);
  return { existia: borradas.count > 0, sesionesCerradas: sesiones.count };
}

/**
 * Barre las excepciones de cuentas que ya no son responsables de nadie.
 * Se llama después de sacar un responsable o borrar un alumno: una fila
 * inerte que se reactiva sola el día que el email vuelve a registrarse no
 * es una revocación.
 *
 * Con `cuentaId` se acota a esa cuenta, y lo que devuelve dice si esa cuenta
 * perdió la puerta. Sin acotar, un Sacar barría filas huérfanas de otras
 * familias (las que deja eliminar un grupo) y el mensaje de pantalla se las
 * atribuía al responsable recién sacado.
 */
export async function limpiarSinEnlaceSinFamilia(cuentaId?: string) {
  const sinFamilia = {
    ...(cuentaId ? { id: cuentaId } : {}),
    tutorias: { none: {} },
  };
  const [filas] = await db.$transaction([
    db.accesoSinEnlace.deleteMany({ where: { cuenta: sinFamilia } }),
    db.sesion.deleteMany({
      where: { abiertaSinEnlace: true, cuenta: sinFamilia },
    }),
  ]);
  return filas.count;
}

/**
 * Para el bloque de Ajustes: todas las puertas abiertas. Las familias con
 * excepción propia y los cursos enteros, en la misma lista de auditoría.
 */
export async function listarSinEnlace() {
  const [filas, cursos] = await Promise.all([
    db.accesoSinEnlace.findMany({
      orderBy: { creadoEn: "desc" },
      include: {
        cuenta: {
          include: {
            tutorias: {
              include: {
                alumno: { include: { grupo: { select: { nombre: true } } } },
              },
            },
          },
        },
      },
    }),
    db.grupo.findMany({
      where: { entradaSinEnlace: true },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        subtitulo: true,
        _count: { select: { alumnos: true } },
      },
    }),
  ]);
  return {
    familias: filas.map((f) => ({
      email: f.cuenta.email,
      desde: f.creadoEn,
      usos: f.usos,
      ultimoUsoEl: f.ultimoUsoEl,
      alumnos: f.cuenta.tutorias.map((t) => ({
        nombre: t.alumno.nombre,
        grupo: t.alumno.grupo.nombre,
      })),
    })),
    cursos: cursos.map((g) => ({
      id: g.id,
      nombre: g.nombre,
      colegio: g.subtitulo,
      alumnos: g._count.alumnos,
    })),
  };
}
