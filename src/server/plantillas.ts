import "server-only";

import { db } from "./db";

/**
 * Los textos de los mails, editables desde el panel.
 *
 * Nacieron escritos adentro de cada función de `notificaciones.ts` y se mudaron
 * acá por el mismo motivo por el que se mudaron los precios del simulador: un
 * texto que le habla a una familia no es una decisión de programación. Se
 * reescribe cuando aparece una forma mejor de decirlo, y si cada cambio pide un
 * deploy, se deja de hacer.
 *
 * Se editan las palabras, no el HTML.
 *
 * Lo que se guarda son cuatro campos de texto por mail. El armado —el logo, el
 * recuadro del monto, el botón, los márgenes que hacen que entre en Gmail— sigue
 * siendo código. Dejar editar HTML crudo garantiza dos cosas: que alguien rompa
 * el render en un cliente de correo que no puede probar, y que se pueda inyectar
 * lo que sea en un mail que sale con nuestro remitente.
 *
 * Los números tampoco se editan. El monto, la fecha y el número de cuota entran
 * por variables —`{monto}`, `{vence}`, `{cuota}`— y los pone el sistema desde el
 * plan, así que un texto editado no puede contradecir a la cuenta.
 *
 * Lo que no está guardado cae al texto del código. Una instalación nueva manda
 * los mismos mails que hoy sin que nadie toque nada, y "restaurar" es borrar la
 * fila.
 */

/* --------------------------------------------------------------- catálogo */

/** Los cuatro campos que se pueden reescribir. */
export type TextosPlantilla = {
  asunto: string;
  titulo: string;
  parrafo: string;
  nota: string;
};

type Definicion = {
  /** Cómo se lo nombra en el panel. */
  nombre: string;
  /** Cuándo sale. Va debajo del nombre: sin esto hay que adivinar. */
  cuando: string;
  /** Qué se puede interpolar, sin las llaves. */
  variables: string[];
  porDefecto: TextosPlantilla;
};

/**
 * El orden es el del recorrido de una familia —la invitan, entra, le recuerdan,
 * paga— y no el alfabético. El panel los lista así.
 */
export const PLANTILLAS = {
  invitacion: {
    nombre: "Invitación",
    cuando: "Cuando se invita a una familia al grupo.",
    variables: ["alumno", "grupo", "cuota", "total", "monto", "vence"],
    porDefecto: {
      asunto: "Pagos de {grupo}",
      titulo: "Pagos de {grupo}",
      parrafo:
        "Ya está abierto el sistema de pagos de {grupo}. Creá tu cuenta para seguir la cuota de {alumno} de principio a fin y acceder a la galería cuando esté lista.",
      nota: "No hace falta contraseña: entrás con tu email.",
    },
  },

  acceso: {
    nombre: "Link para entrar",
    cuando: "Cuando alguien pide entrar a su cuenta.",
    variables: [],
    porDefecto: {
      asunto: "Tu link para entrar — Halley Audiovisual",
      titulo: "Tu link para entrar",
      parrafo:
        "Tocá el botón para entrar a tu cuenta. El link vence en 30 minutos y sirve una sola vez.",
      nota: "Si no lo pediste, ignorá este mensaje.",
    },
  },

  recordatorio: {
    nombre: "Recordatorio de cuota",
    cuando: "Cuando se recuerda una cuota que todavía no venció.",
    variables: ["alumno", "grupo", "cuota", "monto", "vence"],
    porDefecto: {
      asunto: "Recordatorio de cuota — {grupo}",
      titulo: "Recordatorio de cuota",
      parrafo:
        "Queda pendiente la cuota {cuota} de {alumno}. Pagando antes del vencimiento evitás recargos.",
      nota: "Si ya transferiste, ignorá este mensaje.",
    },
  },

  recordatorioVencida: {
    nombre: "Cuota vencida",
    cuando: "El mismo recordatorio, cuando la cuota ya venció.",
    variables: ["alumno", "grupo", "cuota", "monto", "vence"],
    porDefecto: {
      asunto: "Cuota vencida — {grupo}",
      titulo: "Cuota vencida",
      parrafo:
        "La cuota {cuota} de {alumno} venció y figura impaga. Si se atrasa más, se le suma un recargo por mora.",
      nota: "Si ya transferiste, ignorá este mensaje.",
    },
  },

  pagoRecibido: {
    nombre: "Pago acreditado",
    cuando: "Cuando una transferencia completa una cuota.",
    variables: ["alumno", "grupo", "cuota", "monto"],
    porDefecto: {
      asunto: "Recibimos tu pago — {grupo}",
      titulo: "Recibimos tu pago",
      parrafo:
        "Confirmamos la acreditación del pago de la cuota {cuota} de {alumno}. Este mail es tu comprobante.",
      nota: "",
    },
  },

  pagoParcial: {
    nombre: "Pago incompleto",
    cuando: "Cuando entra una transferencia que no alcanza a cubrir la cuota.",
    variables: ["alumno", "grupo", "cuota", "monto", "falta"],
    porDefecto: {
      asunto: "Faltó completar la cuota {cuota} — {grupo}",
      titulo: "Faltó completar la cuota",
      parrafo:
        "Recibimos tu transferencia de {monto} para la cuota {cuota} de {alumno}, pero no alcanzó a cubrirla entera. La cuota sigue figurando impaga hasta que entre la diferencia.",
      nota: "Si ya la transferiste, ignorá este mensaje.",
    },
  },
} as const satisfies Record<string, Definicion>;

export type IdPlantilla = keyof typeof PLANTILLAS;

export const PLANTILLAS_ORDEN = Object.keys(PLANTILLAS) as IdPlantilla[];

/* ---------------------------------------------------------------- lectura */

/** Con qué clave se guarda cada plantilla en `Ajuste`. */
const clave = (id: IdPlantilla) => `plantilla:${id}`;

/**
 * Sólo se guarda lo que difiere del texto del código.
 *
 * Un campo vacío en la base no es "sin texto" sino "no lo tocaron", así que
 * vuelve al de fábrica. La única forma de dejar un campo realmente vacío es que
 * su valor por defecto lo esté — y en ese caso no hay nada que borrar.
 */
function fusionar(id: IdPlantilla, guardado: unknown): TextosPlantilla {
  const base = PLANTILLAS[id].porDefecto;
  if (typeof guardado !== "object" || guardado === null) return base;

  const o = guardado as Record<string, unknown>;
  const campo = (k: keyof TextosPlantilla) =>
    typeof o[k] === "string" && o[k].trim() !== "" ? o[k] : base[k];

  return {
    asunto: campo("asunto"),
    titulo: campo("titulo"),
    parrafo: campo("parrafo"),
    nota: campo("nota"),
  };
}

function leer(valor: string): unknown {
  try {
    return JSON.parse(valor);
  } catch {
    // Una fila ilegible no puede dejar sin mail a nadie: se cae al de fábrica.
    return null;
  }
}

/** Los textos de una plantilla, con lo editado ya puesto encima. */
export async function textosDe(id: IdPlantilla): Promise<TextosPlantilla> {
  const fila = await db.ajuste.findUnique({ where: { clave: clave(id) } });
  return fusionar(id, fila ? leer(fila.valor) : null);
}

/** Todas, para el panel: el texto vigente y si está editado o de fábrica. */
export async function todasLasPlantillas() {
  const filas = await db.ajuste.findMany({
    where: { clave: { in: PLANTILLAS_ORDEN.map(clave) } },
  });
  const porClave = new Map(filas.map((f) => [f.clave, leer(f.valor)]));

  return PLANTILLAS_ORDEN.map((id) => {
    const guardado = porClave.get(clave(id)) ?? null;
    return {
      id,
      nombre: PLANTILLAS[id].nombre,
      cuando: PLANTILLAS[id].cuando,
      variables: [...PLANTILLAS[id].variables],
      porDefecto: PLANTILLAS[id].porDefecto,
      textos: fusionar(id, guardado),
      editada: guardado !== null,
    };
  });
}

/* --------------------------------------------------------------- escritura */

export async function guardarPlantilla(
  id: IdPlantilla,
  textos: TextosPlantilla,
) {
  await db.ajuste.upsert({
    where: { clave: clave(id) },
    create: { clave: clave(id), valor: JSON.stringify(textos) },
    update: { valor: JSON.stringify(textos) },
  });
}

/** Volver al texto del código. Es borrar la fila, no copiar el default encima. */
export async function restaurarPlantilla(id: IdPlantilla) {
  await db.ajuste.deleteMany({ where: { clave: clave(id) } });
}

/* ----------------------------------------------------------------- armado */

/**
 * Reemplaza `{variable}` por su valor.
 *
 * Lo que no está en el diccionario se deja tal cual y no se borra: si alguien
 * escribe `{cuoat}` con un dedazo, que se vea en el mail es molesto pero
 * entendible; que desaparezca la palabra deja una frase rota sin explicación.
 */
export function render(texto: string, variables: Record<string, string>) {
  return texto.replace(/\{(\w+)\}/g, (crudo, nombre: string) =>
    nombre in variables ? (variables[nombre] ?? crudo) : crudo,
  );
}
