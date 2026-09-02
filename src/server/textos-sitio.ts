import "server-only";

import { db } from "./db";

/**
 * Los textos de la web, editables desde el panel.
 *
 * Mismo argumento que movió los precios del simulador y los textos de los mails
 * a la base: no son decisiones de programación. Un titular se reescribe cuando
 * aparece una forma mejor de decirlo, y si cada cambio pide un deploy, se deja
 * de hacer.
 *
 * Cada bloque es un puñado de campos con nombre. No hay estructura libre ni HTML:
 * lo que se edita son las palabras que van adentro de una maqueta que sigue
 * siendo código. Así nadie puede romper el diseño desde el panel, y agregar un
 * bloque nuevo es agregar una entrada acá y leerla donde corresponda.
 *
 * Lo no guardado cae al texto del código, así que una instalación nueva muestra
 * exactamente lo mismo que hoy sin que nadie toque nada, y "volver al original"
 * es borrar la fila y no copiar el valor de fábrica encima.
 */

/* --------------------------------------------------------------- catálogo */

type Campo = {
  etiqueta: string;
  porDefecto: string;
  /** Si va en un área de varias líneas en vez de un renglón. */
  largo?: boolean;
};

type Bloque = {
  nombre: string;
  /** Dónde se ve. Sin esto hay que adivinar qué se está editando. */
  donde: string;
  campos: Record<string, Campo>;
};

export const TEXTOS_SITIO = {
  hero: {
    nombre: "Portada, lo primero que se ve",
    donde:
      "Arriba de todo, sobre el video o la foto de portada. El titular va en tres renglones: los dos primeros preparan y el tercero remata, y por eso el tercero se pinta distinto. Se editan por separado justamente para que el corte de línea no dependa de dónde termine la palabra.",
    campos: {
      rotulo: {
        etiqueta: "Rótulo",
        porDefecto: "Córdoba · Dron, fotografía y video",
      },
      titular1: {
        etiqueta: "Titular, primer renglón",
        porDefecto: "Los momentos",
      },
      titular2: {
        etiqueta: "Titular, segundo renglón",
        porDefecto: "son fugaces.",
      },
      remate: {
        etiqueta: "Titular, remate",
        porDefecto: "Halley los hace eternos.",
      },
      bajada: {
        etiqueta: "Bajada",
        largo: true,
        porDefecto:
          "Productora audiovisual de Córdoba. Egresados, bodas, quince años y marcas. El día pasa una sola vez: nos ocupamos de que puedas volver.",
      },
      boton: { etiqueta: "Botón de WhatsApp", porDefecto: "Pedir presupuesto" },
      botonSecundario: {
        etiqueta: "Botón que baja a servicios",
        porDefecto: "Ver servicios",
      },
      mensajeWhatsapp: {
        etiqueta: "Mensaje con el que se abre el WhatsApp",
        largo: true,
        porDefecto: "Hola Halley, quiero pedir un presupuesto.",
      },
    },
  },

  concepto: {
    nombre: "El cometa",
    donde:
      "Portada, la sección que sigue al hero, la del dibujo del cometa. El segundo renglón del título va en gris: es el remate de la frase, no una frase aparte.",
    campos: {
      titulo1: {
        etiqueta: "Título, primer renglón",
        porDefecto: "Hay quien lo ve una vez en la vida.",
      },
      titulo2: {
        etiqueta: "Título, segundo renglón",
        porDefecto: "Con suerte, dos.",
      },
      parrafo1: {
        etiqueta: "Primer párrafo",
        largo: true,
        porDefecto:
          "El cometa Halley orbita el Sol y se ve desde la Tierra cada 75 años. Es historia viva de la astronomía, pero para dejarse ver pide algo simple: estar ahí, atentos, en el momento justo.",
      },
      parrafo2: {
        etiqueta: "Segundo párrafo",
        largo: true,
        porDefecto:
          "De eso se trata nuestro trabajo. Captamos lo que no se repite —esa mirada, ese abrazo, esa emoción—, y cuando queda registrado en el instante preciso deja de ser sólo un recuerdo: se vuelve un punto de regreso.",
      },
      parrafo3: {
        etiqueta: "Cierre",
        largo: true,
        porDefecto:
          "La posibilidad de volver a sentir, de volver a mirar, de volver a abrazar.",
      },
    },
  },

  servicios: {
    nombre: "Encabezado de los servicios",
    donde:
      "Portada, justo arriba de las cuatro tarjetas. Los nombres y las líneas de cada tarjeta no se editan desde acá: van con la página de cada categoría, para que digan lo mismo en los dos lados.",
    campos: {
      rotulo: { etiqueta: "Rótulo", porDefecto: "Qué hacemos" },
      titulo: { etiqueta: "Título", porDefecto: "Cuatro tipos de día" },
    },
  },
  noNegociamos: {
    nombre: "Lo que no negociamos",
    donde:
      "Portada, sección 'Cómo trabajamos'. Son cuatro cosas que se sostienen a la vez, no cuatro pasos, por eso no van numeradas.",
    campos: {
      rotulo: { etiqueta: "Rótulo", porDefecto: "Cómo trabajamos" },
      titulo: { etiqueta: "Título", porDefecto: "Lo que no negociamos" },

      titulo1: { etiqueta: "1. Título", porDefecto: "Cercanía con oficio" },
      texto1: {
        etiqueta: "1. Texto",
        largo: true,
        porDefecto:
          "Trabajás con la persona especializada en tu tipo de evento, que además va a estar el día de la cobertura. No hay intermediarios ni distancia de empresa.",
      },

      titulo2: {
        etiqueta: "2. Título",
        porDefecto: "Cámaras Sony, todo el equipo igual",
      },
      texto2: {
        etiqueta: "2. Texto",
        largo: true,
        porDefecto:
          "El mismo estándar técnico en cada cámara y cada persona, sin excepciones. Trabajamos al 100% de nuestra capacidad técnica o no lo hacemos.",
      },

      titulo3: { etiqueta: "3. Título", porDefecto: "Innovación constante" },
      texto3: {
        etiqueta: "3. Texto",
        largo: true,
        porDefecto:
          "Miramos lo que se está haciendo y lo que se viene, para llegar a tu evento con algo más que el año pasado.",
      },

      titulo4: { etiqueta: "4. Título", porDefecto: "Nos encontrás" },
      texto4: {
        etiqueta: "4. Texto",
        largo: true,
        porDefecto:
          "Por WhatsApp, por redes o en la oficina. Preguntar algo no debería llevar tres días.",
      },
    },
  },

  contacto: {
    nombre: "Contanos qué día es",
    donde:
      "Portada, sección de contacto, arriba de los botones de WhatsApp y correo.",
    campos: {
      titulo: { etiqueta: "Título", porDefecto: "Contanos qué día es" },
      bajada: {
        etiqueta: "Bajada",
        largo: true,
        porDefecto:
          "Escribinos la fecha y el tipo de evento. Te respondemos con una propuesta y, si querés, nos juntamos a verla.",
      },
    },
  },
} as const satisfies Record<string, Bloque>;

export type IdBloque = keyof typeof TEXTOS_SITIO;
export const BLOQUES_ORDEN = Object.keys(TEXTOS_SITIO) as IdBloque[];

/** Los textos ya resueltos de un bloque: nombre de campo a valor. */
export type TextosBloque<T extends IdBloque> = Record<
  keyof (typeof TEXTOS_SITIO)[T]["campos"],
  string
>;

/* ---------------------------------------------------------------- lectura */

const clave = (id: IdBloque) => `texto:${id}`;

function leer(valor: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(valor);
    return typeof v === "object" && v !== null
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    // Una fila ilegible no puede dejar la página sin texto: cae al de fábrica.
    return null;
  }
}

/**
 * Sólo pisa lo que tiene contenido.
 *
 * Un campo vacío en la base no quiere decir "sin texto" sino "no lo tocaron", y
 * vuelve al de fábrica. Es lo que hace que borrar el contenido de un campo en el
 * panel sea equivalente a restaurarlo, en vez de dejar un hueco en la página.
 */
function fusionar(id: IdBloque, guardado: Record<string, unknown> | null) {
  const campos = TEXTOS_SITIO[id].campos as Record<string, Campo>;
  const salida: Record<string, string> = {};

  for (const [nombre, campo] of Object.entries(campos)) {
    const v = guardado?.[nombre];
    salida[nombre] =
      typeof v === "string" && v.trim() !== "" ? v : campo.porDefecto;
  }
  return salida;
}

/** Los textos de un bloque, con lo editado ya puesto encima. */
export async function textosDeBloque<T extends IdBloque>(
  id: T,
): Promise<TextosBloque<T>> {
  const fila = await db.ajuste.findUnique({ where: { clave: clave(id) } });
  return fusionar(id, fila ? leer(fila.valor) : null) as TextosBloque<T>;
}

/** Todos, para el panel: lo vigente, lo de fábrica y si está editado. */
export async function todosLosBloques() {
  const filas = await db.ajuste.findMany({
    where: { clave: { in: BLOQUES_ORDEN.map(clave) } },
  });
  const porClave = new Map(filas.map((f) => [f.clave, leer(f.valor)]));

  return BLOQUES_ORDEN.map((id) => {
    const guardado = porClave.get(clave(id)) ?? null;
    const campos = TEXTOS_SITIO[id].campos as Record<string, Campo>;

    return {
      id,
      nombre: TEXTOS_SITIO[id].nombre,
      donde: TEXTOS_SITIO[id].donde,
      campos: Object.entries(campos).map(([nombre, c]) => ({
        nombre,
        etiqueta: c.etiqueta,
        largo: c.largo ?? false,
        porDefecto: c.porDefecto,
      })),
      textos: fusionar(id, guardado),
      editado: guardado !== null,
    };
  });
}

/* -------------------------------------------------------------- escritura */

/**
 * Guarda un bloque.
 *
 * Descarta los campos que no existen en el catálogo en vez de guardarlos igual.
 * Sin eso, renombrar un campo dejaría basura en la fila para siempre y nadie se
 * enteraría, porque la lectura la ignora en silencio.
 */
export async function guardarBloque(
  id: IdBloque,
  textos: Record<string, string>,
) {
  const conocidos = Object.keys(TEXTOS_SITIO[id].campos);
  const limpio = Object.fromEntries(
    Object.entries(textos).filter(([k]) => conocidos.includes(k)),
  );

  await db.ajuste.upsert({
    where: { clave: clave(id) },
    create: { clave: clave(id), valor: JSON.stringify(limpio) },
    update: { valor: JSON.stringify(limpio) },
  });
}

/** Volver al texto del código: se borra la fila, no se copia el default. */
export async function restaurarBloque(id: IdBloque) {
  await db.ajuste.deleteMany({ where: { clave: clave(id) } });
}
