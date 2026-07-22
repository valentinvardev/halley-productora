/**
 * Los servicios de Halley, en un solo lugar.
 *
 * Los usan la landing y la página de cada categoría. Están acá y no repartidos
 * porque el nombre, la promesa y el mensaje de WhatsApp tienen que decir lo
 * mismo en los dos lados: si el botón de la landing y el de la página interna
 * mandan mensajes distintos, quien recibe el WhatsApp no sabe de dónde vino.
 */

export const WHATSAPP = "5493513000000";
export const INSTAGRAM = "https://instagram.com/halley.audiovisual";
export const MAIL = "hola@halleyaudiovisual.com";

export function linkWhatsApp(mensaje: string) {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
}

export type Servicio = {
  slug: string;
  nombre: string;
  /** La promesa, en una línea. */
  linea: string;
  detalle: string;
  /** Titular de la página de la categoría. */
  titular: string;
  entrada: string;
  /** Qué se lleva la familia o la marca. No son pasos: no van numerados. */
  incluye: { titulo: string; texto: string }[];
  /** Lo que hay que saber antes de escribir. */
  aclaracion: string;
  /** Cuántos huecos de multimedia tiene la galería de la categoría. */
  piezas: number;
};

export const SERVICIOS: Servicio[] = [
  {
    slug: "egresados",
    nombre: "Egresados",
    linea: "El último año, de la previa al último tema.",
    detalle:
      "Cobertura del evento con dron, fotos y video editado. El curso contrata una vez y cada familia paga su cuota desde su propio panel.",
    titular: "El último año pasa una sola vez",
    entrada:
      "Cubrimos la fiesta de egresados de punta a punta: la previa, la entrada, el brindis y lo que pase después. Un curso entero, un solo contrato, y cada familia con su cuota al día desde su panel.",
    incluye: [
      {
        titulo: "Cobertura completa de la noche",
        texto:
          "Estamos desde la previa hasta que se apaga la música. Nadie se queda afuera de las fotos por llegar tarde o irse temprano.",
      },
      {
        titulo: "Dron",
        texto:
          "Tomas aéreas de la llegada y del salón, que son las que después nadie tiene.",
      },
      {
        titulo: "Fotos y video editado",
        texto:
          "El video se mira entero, no de a fragmentos. Las fotos quedan en una galería que se puede bajar.",
      },
      {
        titulo: "Cada familia con su cuota",
        texto:
          "El curso arma el plan una vez y cada familia sigue lo suyo desde su panel: cuánto pagó, cuánto falta y cuándo vence.",
      },
    ],
    aclaracion:
      "Trabajamos con cursos de todo Córdoba. Conviene escribirnos apenas tengan fecha: los fines de semana de octubre y noviembre se ocupan primero.",
    piezas: 6,
  },
  {
    slug: "bodas",
    nombre: "Bodas",
    linea: "Desde los preparativos hasta que se apaga la música.",
    detalle:
      "Dos miradas en simultáneo, tomas aéreas y el video que se mira entero, no de a fragmentos.",
    titular: "Un día que se cuenta entero",
    entrada:
      "Los preparativos, la ceremonia, la fiesta. Dos personas cubriendo en simultáneo para que nada quede fuera de cuadro, y un video que se mira de principio a fin.",
    incluye: [
      {
        titulo: "Dos miradas al mismo tiempo",
        texto:
          "Mientras una cámara está con ella, la otra está con él. Después eso se nota en el montaje.",
      },
      {
        titulo: "Ceremonia y fiesta",
        texto:
          "Cobertura continua, sin cortes por cambio de locación ni por horario.",
      },
      {
        titulo: "Dron",
        texto:
          "Aéreas del lugar y de los momentos que se ven mejor desde arriba.",
      },
      {
        titulo: "Video que se mira entero",
        texto:
          "Editamos para que se pueda ver de una sentada, no como un archivo de tres horas que nadie abre dos veces.",
      },
    ],
    aclaracion:
      "Nos gusta conocer el lugar antes. Si nos escribís con tiempo, coordinamos una visita previa sin cargo.",
    piezas: 6,
  },
  {
    slug: "quince",
    nombre: "Quince años",
    linea: "La sesión previa, la entrada, el vals.",
    detalle:
      "Producción de la sesión con la quinceañera y cobertura completa de la fiesta, con el material listo para compartir.",
    titular: "La sesión, la entrada, el vals",
    entrada:
      "Empezamos antes de la fiesta, con una sesión pensada con ella. Después cubrimos la noche completa y entregamos el material listo para compartir.",
    incluye: [
      {
        titulo: "Sesión previa",
        texto:
          "Producción de fotos con la quinceañera, en el lugar que elija. Se arma junto con ella, no se le impone un guion.",
      },
      {
        titulo: "Cobertura de la fiesta",
        texto: "La entrada, el vals, el brindis y el baile, sin cortes.",
      },
      {
        titulo: "Dron",
        texto: "Aéreas de la llegada y del salón.",
      },
      {
        titulo: "Listo para compartir",
        texto:
          "Además del video largo, cortes verticales pensados para el teléfono: es donde realmente se van a ver.",
      },
    ],
    aclaracion:
      "La sesión previa se coordina con varias semanas de anticipación, así hay margen para elegir locación y vestuario.",
    piezas: 6,
  },
  {
    slug: "marcas",
    nombre: "Marcas",
    linea: "Publicidad, institucional, recitales y contenido para redes.",
    detalle:
      "Piezas pensadas para dónde se van a ver: un spot no se corta igual para una pantalla que para un teléfono.",
    titular: "Contenido que sabe dónde se va a ver",
    entrada:
      "Publicidad, institucional, recitales y contenido para redes. Un spot no se corta igual para una pantalla grande que para un teléfono, y eso se decide antes de filmar, no después.",
    incluye: [
      {
        titulo: "Publicidad e institucional",
        texto:
          "Piezas para campaña, presentación de producto o video institucional.",
      },
      {
        titulo: "Recitales y eventos",
        texto:
          "Cobertura multicámara de shows, con el registro del público que es la mitad del clima.",
      },
      {
        titulo: "Contenido para redes",
        texto:
          "Cortes verticales, reels y material pensado para publicar seguido, no una vez al año.",
      },
      {
        titulo: "Dron",
        texto: "Aéreas de planta, local, obra o locación.",
      },
    ],
    aclaracion:
      "Trabajamos por proyecto o por abono mensual, según cada cuánto necesites publicar.",
    piezas: 6,
  },
];

export function servicioPorSlug(slug: string) {
  return SERVICIOS.find((s) => s.slug === slug) ?? null;
}

/** El mensaje con el que llega el WhatsApp desde cada categoría. */
export function consultaDe(servicio: Servicio) {
  return `Hola Halley, quiero consultar por ${servicio.nombre.toLowerCase()}.`;
}
