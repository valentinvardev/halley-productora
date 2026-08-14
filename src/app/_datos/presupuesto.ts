/**
 * El catálogo del simulador de presupuesto.
 *
 * Todo lo que se puede contratar, cuánto sale y cómo se paga, en un solo lugar.
 * Es el gemelo de `servicios.ts`: allá vive lo que se cuenta, acá lo que se
 * cobra. Están separados porque cambian a distinto ritmo —la promesa de una
 * categoría dura años, un precio dura una temporada— y porque este archivo es
 * el único que hay que abrir para actualizar la lista.
 *
 * Corre en el cliente y en el servidor. El wizard suma en vivo mientras la
 * persona elige, y el servidor vuelve a sumar antes de guardar: el total que
 * llega por la red no se cree nunca, se recalcula. Por eso acá no hay nada que
 * dependa del navegador ni de la base.
 *
 * Los precios quedan congelados en el presupuesto emitido. Si mañana cambian
 * los números de este archivo, un presupuesto ya generado sigue diciendo lo que
 * decía el día que se emitió — que es lo que hace que el código de seguimiento
 * signifique algo.
 */

/* ------------------------------------------------------------------ eventos */

export type Evento = "quince" | "boda";

export const EVENTOS = {
  quince: {
    nombre: "Mi Quince",
    /** Cómo se lo nombra en una frase: "tu quince", "tu boda". */
    posesivo: "tu quince",
    /** La categoría de `servicios.ts` de la que sale. */
    servicio: "quince",
    /** Primera letra del código de seguimiento. */
    inicial: "Q",
  },
  boda: {
    nombre: "Mi Boda",
    posesivo: "tu boda",
    servicio: "bodas",
    inicial: "B",
  },
} as const satisfies Record<
  Evento,
  { nombre: string; posesivo: string; servicio: string; inicial: string }
>;

export const EVENTOS_ORDEN: Evento[] = ["boda", "quince"];

export function esEvento(v: string): v is Evento {
  return v === "quince" || v === "boda";
}

/**
 * De qué categoría de `servicios.ts` sale cada evento, y la vuelta.
 *
 * Los dos nombres no coinciden y no se los fuerza a coincidir: la categoría se
 * llama "bodas" —son todas las bodas que cubrimos— y el evento se llama "boda"
 * —es la tuya—. Cambiar el slug de la categoría rompería links ya publicados,
 * así que la traducción vive acá, en una función y en un solo lugar.
 *
 * Es también la lista de qué categorías tienen simulador: las que no aparecen
 * acá no muestran el botón, y no hace falta acordarse de eso en cada página.
 */
export function eventoDeServicio(slug: string): Evento | null {
  for (const evento of EVENTOS_ORDEN) {
    if (EVENTOS[evento].servicio === slug) return evento;
  }
  return null;
}

/* ------------------------------------------------------------------ precios */

/**
 * Si los precios ya son los definitivos.
 *
 * Mientras esté en `false`, el simulador muestra los valores como referencia y
 * lo dice en pantalla. No es una decoración: un presupuesto que sale con
 * números provisorios sin avisar es una promesa que después hay que romper.
 *
 * Al cargar la lista real de Halley, esto pasa a `true` y el aviso desaparece
 * solo.
 */
export const PRECIOS_CONFIRMADOS = false;

/**
 * Si la Parte 1 admite combinar varias opciones o es una sola.
 *
 * Va en `true` porque los ítems de esa parte son momentos del mismo día, no
 * paquetes alternativos: lo normal es querer los preparativos *y* la fiesta.
 * Con selección única el caso más común no se podría cotizar.
 *
 * Si Halley prefiere que sea excluyente —una sola opción, como las sesiones de
 * la referencia— alcanza con poner `false`: el paso pasa a comportarse como un
 * grupo de radios y el resto del wizard no se entera.
 */
export const MOMENTOS_COMBINABLES = true;

/* ---------------------------------------------------------------- el catálogo */

/** Dónde se hace el book. Cambia la logística, así que cambia el precio. */
export type Locacion = {
  id: string;
  nombre: string;
  texto: string;
  /** Lo que suma sobre el precio base del ítem. El primero suele ser 0. */
  extra: number;
};

export type Item = {
  id: string;
  nombre: string;
  texto: string;
  precio: number;
  /**
   * Sólo el book. Es el nivel extra de elección que ningún otro ítem tiene: se
   * resuelve mostrando las locaciones adentro de la tarjeta, y sólo cuando la
   * tarjeta está elegida. Tres tarjetas sueltas dirían que son tres productos
   * distintos, y es uno con tres formas.
   */
  locaciones?: Locacion[];
};

export type Parte = {
  id: "momentos" | "coberturas" | "complementos";
  rotulo: string;
  titulo: string;
  bajada: string;
  /** Si se pueden elegir varios. La Parte 1 depende de MOMENTOS_COMBINABLES. */
  multiple: boolean;
  items: Item[];
};

/** Las tres locaciones del book. Son las mismas para los dos eventos. */
const LOCACIONES: Locacion[] = [
  {
    id: "estudio",
    nombre: "Estudio",
    texto: "Luz controlada y fondo limpio. La opción de siempre, y la más ágil.",
    extra: 0,
  },
  {
    id: "abiertos",
    nombre: "Espacios abiertos privados",
    texto:
      "Quinta, casona o parque cerrado. Da aire a las fotos sin gente alrededor.",
    extra: 90_000,
  },
  {
    id: "sierras",
    nombre: "Sierras o altas cumbres",
    texto:
      "Una jornada afuera, con traslado y luz de atardecer. Es la que más se nota.",
    extra: 180_000,
  },
];

/**
 * Las coberturas y los complementos son los mismos para los dos eventos: lo que
 * cambia entre una boda y un quince son los momentos, no las cámaras.
 */
const COBERTURAS: Item[] = [
  {
    id: "fotografia",
    nombre: "Fotografía",
    texto:
      "Cobertura fotográfica completa, con las fotos editadas en una galería que se puede bajar.",
    precio: 540_000,
  },
  {
    id: "video-dron",
    nombre: "Video y dron para exterior",
    texto:
      "El video editado que se mira entero, con las tomas aéreas de la llegada y del lugar.",
    precio: 760_000,
  },
  {
    id: "redes",
    nombre: "Contenido para redes",
    texto:
      "Cortes verticales pensados para el teléfono, listos para publicar la misma semana.",
    precio: 290_000,
  },
];

const COMPLEMENTOS: Item[] = [
  {
    id: "segundo-fotografo",
    nombre: "Segundo fotógrafo",
    texto:
      "Dos miradas al mismo tiempo. Mientras una cámara está en un lado, la otra está en el otro.",
    precio: 380_000,
  },
  {
    id: "invitacion",
    nombre: "Invitación digital",
    texto:
      "La invitación para mandar por WhatsApp, con el diseño del evento.",
    precio: 95_000,
  },
  {
    id: "dron-interior",
    nombre: "Drone acrobático para interiores",
    texto:
      "El plano continuo que entra al salón y lo recorre sin cortar. Es la toma que nadie más tiene.",
    precio: 340_000,
  },
  {
    id: "edicion-vivo",
    nombre: "Edición en vivo de video",
    texto:
      "Un corte editado durante la fiesta, para proyectarlo antes de que termine la noche.",
    precio: 420_000,
  },
  {
    id: "video-ingreso",
    nombre: "Video para ingreso al salón",
    texto:
      "La pieza que se proyecta en la entrada, armada con material previo.",
    precio: 260_000,
  },
  {
    id: "impresion-vivo",
    nombre: "Entrega de fotografía impresa en vivo",
    texto:
      "Impresión en el momento, para que cada invitado se lleve su foto de la fiesta.",
    precio: 310_000,
  },
  {
    id: "fotolibro",
    nombre: "Fotolibro de 10 páginas 30x45",
    texto:
      "El libro impreso, con las fotos elegidas y encuadernado. Lo que queda en la mesa.",
    precio: 450_000,
  },
];

/** Los momentos de un quince. */
const MOMENTOS_QUINCE: Item[] = [
  {
    id: "book-15",
    nombre: "Book Pre 15",
    texto:
      "La sesión previa, armada junto con ella. Se elige dónde se hace y de ahí sale buena parte del resultado.",
    precio: 480_000,
    locaciones: LOCACIONES,
  },
  {
    id: "preparativos",
    nombre: "Preparativos previos",
    texto:
      "El maquillaje, el vestido, la casa antes de salir. Es donde están los nervios y la familia junta.",
    precio: 320_000,
  },
  {
    id: "fiesta",
    nombre: "Cobertura de la fiesta",
    texto:
      "La entrada, el vals, el brindis y el baile, de punta a punta y sin cortes.",
    precio: 980_000,
  },
];

/**
 * Los momentos de una boda.
 *
 * Es la estructura equivalente a la de quince, con lo que una boda tiene y un
 * quince no: el civil y la ceremonia son dos actos separados, con horarios y
 * lugares propios, y cotizarlos juntos obligaría a cobrar de más al que sólo
 * hace uno. Los otros tres son los mismos momentos con otro nombre.
 */
const MOMENTOS_BODA: Item[] = [
  {
    id: "book-boda",
    nombre: "Sesión pre boda",
    texto:
      "La sesión de los dos antes del día. Se elige dónde se hace y de ahí sale buena parte del resultado.",
    precio: 520_000,
    locaciones: LOCACIONES,
  },
  {
    id: "preparativos",
    nombre: "Preparativos de los novios",
    texto:
      "Las dos casas en simultáneo: mientras una cámara está con ella, la otra está con él.",
    precio: 420_000,
  },
  {
    id: "civil",
    nombre: "Civil",
    texto: "El registro del acto y de la salida, con los testigos y la familia.",
    precio: 290_000,
  },
  {
    id: "ceremonia",
    nombre: "Ceremonia",
    texto:
      "La entrada, los votos y la salida. Cobertura continua, sin cortes por cambio de lugar.",
    precio: 480_000,
  },
  {
    id: "fiesta",
    nombre: "Cobertura de la fiesta",
    texto:
      "Desde el brindis hasta que se apaga la música. Nadie se queda afuera por irse temprano.",
    precio: 1_090_000,
  },
];

function partesDe(momentos: Item[], quePasa: string): Parte[] {
  return [
    {
      id: "momentos",
      rotulo: "Parte 1",
      titulo: "Qué momentos cubrimos",
      bajada: quePasa,
      multiple: MOMENTOS_COMBINABLES,
      items: momentos,
    },
    {
      id: "coberturas",
      rotulo: "Parte 2",
      titulo: "Con qué lo cubrimos",
      bajada:
        "Fotografía, video o las dos. Podés sumar todas las que quieras: cada una es un equipo más trabajando ese día.",
      multiple: true,
      items: COBERTURAS,
    },
    {
      id: "complementos",
      rotulo: "Parte 3",
      titulo: "Que no le falte nada",
      bajada:
        "Lo que se agrega sobre la cobertura. Nada de esto es obligatorio y todo se puede decidir después.",
      multiple: true,
      items: COMPLEMENTOS,
    },
  ];
}

export const CATALOGO: Record<Evento, Parte[]> = {
  quince: partesDe(
    MOMENTOS_QUINCE,
    "Elegí qué partes del día queremos registrar. Se pueden combinar, y cada una se cotiza aparte.",
  ),
  boda: partesDe(
    MOMENTOS_BODA,
    "Una boda son varios actos en un día. Elegí cuáles cubrimos: se pueden combinar y cada uno se cotiza aparte.",
  ),
};

/** Un ítem por id, dentro de un evento. */
export function itemDe(evento: Evento, id: string): Item | null {
  for (const parte of CATALOGO[evento]) {
    const item = parte.items.find((i) => i.id === id);
    if (item) return item;
  }
  return null;
}

/* ---------------------------------------------------------------- selección */

/**
 * Lo que la persona eligió, que es lo único que el wizard guarda en memoria.
 *
 * Son ids y no objetos: así el estado se puede serializar entero para mandarlo
 * al servidor o meterlo en la URL, y el precio se resuelve siempre desde el
 * catálogo. Un estado que se guarda con los precios adentro es un estado que
 * puede quedar desactualizado sin que nadie se entere.
 */
export type Seleccion = {
  items: string[];
  /** Para el book: qué locación se eligió. Clave por id de ítem. */
  locaciones: Record<string, string>;
};

export const SELECCION_VACIA: Seleccion = { items: [], locaciones: {} };

/**
 * La selección que dio origen a estas líneas.
 *
 * Es el camino de vuelta: un presupuesto guardado se abre en el wizard tal como
 * lo dejó su dueño. Los ítems que ya no estén en el catálogo se caen solos al
 * recalcular, así que no hay que filtrarlos acá.
 */
export function seleccionDe(lineas: Linea[]): Seleccion {
  const locaciones: Record<string, string> = {};
  for (const l of lineas) {
    if (l.locacion) locaciones[l.id] = l.locacion;
  }
  return { items: lineas.map((l) => l.id), locaciones };
}

/** Los ids de la selección que el catálogo de este evento todavía conoce. */
export function depurar(evento: Evento, sel: Seleccion): Seleccion {
  const validos = new Set(
    CATALOGO[evento].flatMap((p) => p.items.map((i) => i.id)),
  );
  const items = sel.items.filter((id) => validos.has(id));
  const locaciones = Object.fromEntries(
    Object.entries(sel.locaciones).filter(([id]) => validos.has(id)),
  );
  return { items, locaciones };
}

/** Una línea del presupuesto, ya con el precio resuelto. */
export type Linea = {
  id: string;
  nombre: string;
  /** El nombre de la locación elegida, cuando la hay. Es lo que se muestra. */
  detalle?: string;
  /**
   * El id de esa locación. No se muestra nunca: está para poder rearmar la
   * selección exacta al reeditar un presupuesto guardado. Sin esto habría que
   * adivinar la locación a partir de su nombre, que es lo único que cambia
   * cuando alguien corrige una mayúscula en el catálogo.
   */
  locacion?: string;
  precio: number;
};

/**
 * Las líneas del presupuesto, en el orden del catálogo.
 *
 * Recorre el catálogo y no la selección a propósito: así el orden de las líneas
 * es siempre el mismo —el de la página— y no el orden en que la persona fue
 * tocando las tarjetas. Y un id que ya no existe en el catálogo desaparece solo
 * en vez de romper la suma.
 */
export function lineasDe(evento: Evento, sel: Seleccion): Linea[] {
  const elegidos = new Set(sel.items);
  const lineas: Linea[] = [];

  for (const parte of CATALOGO[evento]) {
    for (const item of parte.items) {
      if (!elegidos.has(item.id)) continue;

      const locacion = item.locaciones?.find(
        (l) => l.id === sel.locaciones[item.id],
      );

      lineas.push({
        id: item.id,
        nombre: item.nombre,
        detalle: locacion?.nombre,
        locacion: locacion?.id,
        precio: item.precio + (locacion?.extra ?? 0),
      });
    }
  }

  return lineas;
}

export function totalDe(lineas: Linea[]) {
  return lineas.reduce((suma, l) => suma + l.precio, 0);
}

/* ------------------------------------------------------------------ reserva */

/**
 * La reserva: lo que se abona para congelar el precio y bloquear la fecha.
 *
 * Es un porcentaje con piso, y no un monto fijo, porque tiene que sostener dos
 * casos que están lejos: una cobertura suelta y un evento completo. Un fijo que
 * sirva para el grande espanta al chico, y uno que sirva para el chico no
 * reserva nada en el grande.
 *
 * Se descuenta del total: no es un cargo, es la primera parte del pago.
 *
 * Si Halley prefiere un número redondo y parejo, se cambia acá y en ningún otro
 * lado — el resto del sistema pregunta por esta función.
 */
export const RESERVA = { porcentaje: 0.2, minimo: 250_000 };

export function reservaDe(total: number) {
  if (total <= 0) return 0;
  // Nunca más que el total: en una contratación mínima, el piso podría
  // superarlo y quedaría un saldo negativo.
  return Math.min(total, Math.max(RESERVA.minimo, Math.round(total * RESERVA.porcentaje)));
}

/* -------------------------------------------------------------- financiación */

export type Plan = {
  id: string;
  nombre: string;
  texto: string;
  cuotas: number;
  /**
   * Qué se le hace al saldo. 0.9 es diez por ciento menos; 1.3 es treinta por
   * ciento más. Uno redondo es sin interés.
   */
  coeficiente: number;
  /** Se marca en la tarjeta. Sólo uno. */
  destacado?: boolean;
};

export const PLANES: Plan[] = [
  {
    id: "unico",
    nombre: "Pago único",
    texto: "El saldo completo al confirmar, con 10% de descuento.",
    cuotas: 1,
    coeficiente: 0.9,
  },
  {
    id: "3",
    nombre: "3 cuotas",
    texto: "Sin interés.",
    cuotas: 3,
    coeficiente: 1,
    destacado: true,
  },
  {
    id: "6",
    nombre: "6 cuotas",
    texto: "Sin interés.",
    cuotas: 6,
    coeficiente: 1,
  },
  {
    id: "9",
    nombre: "9 cuotas",
    texto: "Con 30% de interés sobre el saldo.",
    cuotas: 9,
    coeficiente: 1.3,
  },
];

export function planDe(id: string) {
  return PLANES.find((p) => p.id === id) ?? null;
}

/** Cómo queda la plata con un total y un plan elegido. */
export type Cierre = {
  total: number;
  reserva: number;
  /** Lo que falta después de la reserva, antes de aplicar el plan. */
  saldo: number;
  /** El saldo con el descuento o el interés del plan ya aplicado. */
  saldoFinanciado: number;
  /** Negativo si es descuento, positivo si es interés. Cero si no hay. */
  ajuste: number;
  cuotas: number;
  porCuota: number;
  /** Reserva + saldo financiado. Es lo que termina pagando. */
  aPagar: number;
};

export function cierreDe(total: number, planId: string): Cierre {
  const plan = planDe(planId) ?? PLANES[1]!;
  const reserva = reservaDe(total);
  const saldo = Math.max(0, total - reserva);
  const saldoFinanciado = Math.round(saldo * plan.coeficiente);

  return {
    total,
    reserva,
    saldo,
    saldoFinanciado,
    ajuste: saldoFinanciado - saldo,
    cuotas: plan.cuotas,
    porCuota: plan.cuotas > 0 ? Math.round(saldoFinanciado / plan.cuotas) : 0,
    aPagar: reserva + saldoFinanciado,
  };
}

/* ---------------------------------------------------------------- Halley Box */

/**
 * La caja de regalos, que se revela a medida que el presupuesto crece.
 *
 * Va por monto y no por cantidad de ítems: contar ítems premia sumar cosas
 * baratas, que es exactamente el incentivo que no se quiere. Y va como barra
 * persistente en el pie y no como paso propio, porque un paso dedicado sería un
 * corte más en un wizard que ya tiene siete, y porque el sentido de una barra
 * es que se vea llenar mientras uno elige.
 *
 * El contenido queda sin listar. Es una caja sorpresa: enumerarla la convierte
 * en una lista de productos, y una lista se compara.
 */
export const HALLEY_BOX = {
  nombre: "Halley Box",
  umbral: 2_400_000,
  teaser:
    "Una caja con regalos nuestros y de las marcas con las que trabajamos. No decimos qué trae.",
  desbloqueada: "Va con tu contratación. Te la entregamos el día del evento.",
};

export function progresoBox(total: number) {
  const falta = Math.max(0, HALLEY_BOX.umbral - total);
  return {
    falta,
    abierta: falta === 0,
    /** De 0 a 1, para la barra. */
    parte: Math.min(1, HALLEY_BOX.umbral > 0 ? total / HALLEY_BOX.umbral : 1),
  };
}

/* --------------------------------------------------------- código de seguimiento */

/**
 * El apellido tal como entra en un código: sin acentos, sin espacios, en
 * mayúsculas y recortado.
 *
 * Se toma la última palabra de lo que la persona escribió en "Nombre". No es
 * exacto —hay quien escribe sólo el nombre de pila, y hay apellidos de dos
 * palabras— pero el código no identifica a nadie por sí solo: identifica un
 * presupuesto, y para eso ya está el hash. El apellido está para que el código
 * se pueda leer por teléfono y alguien lo reconozca.
 */
export function apellidoDe(nombre: string) {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z ]/g, " ")
    .trim();

  const palabras = limpio.split(/\s+/).filter(Boolean);
  const ultima = palabras[palabras.length - 1] ?? "";
  return ultima.toUpperCase().slice(0, 12) || "CLIENTE";
}

/**
 * El alfabeto del hash, sin los caracteres que se confunden al dictarlo.
 *
 * Fuera 0/O, 1/I/L y 5/S: el código se pasa por WhatsApp pero también se lee en
 * voz alta, y un cero que alguien anota como o es un presupuesto que no se
 * encuentra.
 */
export const ALFABETO_CODIGO = "2346789ABCDEFGHJKMNPQRTUVWXYZ";

export function armarCodigo(
  evento: Evento,
  nombre: string,
  anio: number,
  hash: string,
) {
  return `${EVENTOS[evento].inicial}-${apellidoDe(nombre)}-${anio}-${hash}`;
}
