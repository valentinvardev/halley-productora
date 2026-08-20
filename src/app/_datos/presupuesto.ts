/**
 * Las reglas del presupuesto: qué forma tiene un catálogo y cómo se suma.
 *
 * El catálogo en sí —los ítems, los textos, los precios— ya no vive acá: vive
 * en la base y se edita desde el panel, porque un precio no es una decisión de
 * programación. Lo que queda en este archivo son los tipos, la aritmética y el
 * catálogo inicial con el que se siembra una base vacía.
 *
 * Todo esto es puro: corre igual en el navegador y en el servidor. El wizard
 * suma en vivo mientras la persona elige y el servidor vuelve a sumar antes de
 * guardar, con las mismas funciones y el mismo catálogo, así que los dos totales
 * coinciden por construcción. El que llega por la red no se cree nunca.
 *
 * Los precios quedan congelados en el presupuesto emitido: si mañana cambian en
 * el panel, uno ya generado sigue diciendo lo que decía el día que salió — que
 * es lo que hace que el código de seguimiento signifique algo.
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
 * Las perillas del flujo, que también se manejan desde el panel.
 *
 * Van juntas y viajan juntas: cualquier pantalla que muestre plata necesita las
 * cuatro, y pasarlas de a una terminaba en funciones con cinco argumentos
 * sueltos que era fácil cruzar.
 */
export type Parametros = {
  /** Qué parte del total se pide de reserva. 0,2 es el veinte por ciento. */
  reservaPorcentaje: number;
  /** Y nunca menos que esto. */
  reservaMinimo: number;
  /** A partir de qué monto se desbloquea la Halley Box. */
  boxUmbral: number;
  /**
   * Si los precios cargados ya son los definitivos.
   *
   * Mientras esté en `false`, el simulador muestra los valores como referencia
   * y lo dice en pantalla. No es una decoración: un presupuesto que sale con
   * números provisorios sin avisar es una promesa que después hay que romper.
   */
  preciosConfirmados: boolean;
};

export const PARAMETROS_POR_DEFECTO: Parametros = {
  reservaPorcentaje: 0.2,
  reservaMinimo: 250_000,
  boxUmbral: 2_400_000,
  preciosConfirmados: false,
};

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

/**
 * Una opción que cuelga de un ítem y le cambia el precio.
 *
 * Hay dos clases y se comportan distinto:
 *
 * - Las **locaciones** son excluyentes: el book se hace en un lugar, y elegir
 *   uno reemplaza al anterior.
 * - Las **coberturas** son acumulables: un momento se puede cubrir con foto, con
 *   video o con las dos.
 *
 * Comparten la forma porque son lo mismo por debajo —algo que suma sobre el
 * precio del ítem— y lo que cambia es cuántas se pueden tener a la vez.
 */
export type Opcion = {
  id: string;
  nombre: string;
  texto: string;
  /** Lo que suma sobre el precio base del ítem. */
  extra: number;
  /**
   * La foto, ya resuelta a una URL servible. El catálogo guarda el id de la
   * pieza; acá llega el link, porque quien pinta la tarjeta no tiene por qué
   * saber de dónde salen las imágenes.
   */
  imagen?: string;
};

export type Item = {
  id: string;
  nombre: string;
  texto: string;
  /**
   * Lo que cuesta el ítem por sí mismo, antes de lo que le cuelgue.
   *
   * En los momentos es cero y el precio lo ponen enteramente sus coberturas.
   *
   * Hubo un tiempo en que cobraban una base aparte —la idea era que estar ahí
   * vale algo aunque no se entregue nada— y encima se sumaba lo que se
   * registra. En la pantalla eso se leía como un precio cobrado dos veces: la
   * tarjeta decía "Desde $480.000" y abajo foto y video sumaban de nuevo. Y la
   * base tenía además un problema propio: no se puede contratar un momento sin
   * al menos una cobertura, así que era un número que nadie podía pagar.
   *
   * Ahora cubrir la fiesta con foto vale lo que dice fotografía, y punto. Que
   * el civil y la fiesta valgan distinto ya lo resuelven sus coberturas, que
   * tienen precio propio en cada momento.
   *
   * En los complementos sigue siendo el precio del complemento: no cuelga nada
   * de ellos.
   */
  precio: number;
  /** La foto, ya resuelta a una URL servible. */
  imagen?: string;
  /** Dónde se hace. Excluyentes: una sola. */
  locaciones?: Opcion[];
  /** Con qué se cubre. Acumulables, y al menos una si el ítem tiene. */
  coberturas?: Opcion[];
};

export type Parte = {
  id: "momentos" | "complementos";
  rotulo: string;
  titulo: string;
  bajada: string;
  /** Si se pueden elegir varios. */
  multiple: boolean;
  items: Item[];
};

/** Las tres locaciones del book. Son las mismas para los dos eventos. */
const LOCACIONES: Opcion[] = [
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
 * Con qué se cubre un momento, y cuánto suma en ese momento.
 *
 * Los textos son los mismos en todos lados —fotografía es fotografía— y lo que
 * cambia entre un momento y otro son los dos números. Por eso se arman con una
 * función en vez de repetir las descripciones cinco veces.
 *
 * Son dos y no tres: el contenido para redes salió de acá. Es un entregable de
 * lo que ya se filmó, no otra forma de cubrir el momento, así que preguntarlo
 * cinco veces —una por momento— era pedir la misma respuesta muchas veces. Si
 * vuelve, va como complemento.
 */
function coberturas(foto: number, video: number): Opcion[] {
  return [
    {
      id: "fotografia",
      nombre: "Fotografía",
      texto: "Las fotos editadas, en una galería que se puede bajar.",
      extra: foto,
    },
    {
      id: "video-dron",
      nombre: "Video y dron",
      texto: "El video editado, con las tomas aéreas donde se pueda volar.",
      extra: video,
    },
  ];
}

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
    texto: "La invitación para mandar por WhatsApp, con el diseño del evento.",
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
    texto: "La pieza que se proyecta en la entrada, armada con material previo.",
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
    precio: 0,
    locaciones: LOCACIONES,
    coberturas: coberturas(230_000, 280_000),
  },
  {
    id: "preparativos",
    nombre: "Preparativos previos",
    texto:
      "El maquillaje, el vestido, la casa antes de salir. Es donde están los nervios y la familia junta.",
    precio: 0,
    coberturas: coberturas(160_000, 210_000),
  },
  {
    id: "fiesta",
    nombre: "Cobertura de la fiesta",
    texto:
      "La entrada, el vals, el brindis y el baile, de punta a punta y sin cortes.",
    precio: 0,
    coberturas: coberturas(400_000, 520_000),
  },
];

/**
 * Los momentos de una boda.
 *
 * Es la estructura equivalente a la de quince, con lo que una boda tiene y un
 * quince no: el civil y la ceremonia son dos actos separados, con horarios y
 * lugares propios, y cotizarlos juntos obligaría a cobrarle de más al que sólo
 * hace uno.
 */
const MOMENTOS_BODA: Item[] = [
  {
    id: "book-boda",
    nombre: "Sesión pre boda",
    texto:
      "La sesión de los dos antes del día. Se elige dónde se hace y de ahí sale buena parte del resultado.",
    precio: 0,
    locaciones: LOCACIONES,
    coberturas: coberturas(240_000, 300_000),
  },
  {
    id: "preparativos",
    nombre: "Preparativos de los novios",
    texto:
      "Las dos casas en simultáneo: mientras una cámara está con ella, la otra está con él.",
    precio: 0,
    coberturas: coberturas(190_000, 250_000),
  },
  {
    id: "civil",
    nombre: "Civil",
    texto: "El registro del acto y de la salida, con los testigos y la familia.",
    precio: 0,
    coberturas: coberturas(140_000, 180_000),
  },
  {
    id: "ceremonia",
    nombre: "Ceremonia",
    texto:
      "La entrada, los votos y la salida. Cobertura continua, sin cortes por cambio de lugar.",
    precio: 0,
    coberturas: coberturas(220_000, 290_000),
  },
  {
    id: "fiesta",
    nombre: "Cobertura de la fiesta",
    texto:
      "Desde el brindis hasta que se apaga la música. Nadie se queda afuera por irse temprano.",
    precio: 0,
    coberturas: coberturas(430_000, 560_000),
  },
];

function partesDe(momentos: Item[], quePasa: string): Parte[] {
  return [
    {
      id: "momentos",
      rotulo: "Parte 1",
      titulo: "Qué cubrimos y con qué",
      bajada: quePasa,
      multiple: MOMENTOS_COMBINABLES,
      items: momentos,
    },
    {
      id: "complementos",
      rotulo: "Parte 2",
      titulo: "Que no le falte nada",
      bajada:
        "Lo que se agrega sobre la cobertura. Nada de esto es obligatorio y todo se puede decidir después.",
      multiple: true,
      items: COMPLEMENTOS,
    },
  ];
}

/**
 * El catálogo con el que se siembra una base vacía.
 *
 * No es "el catálogo": es el punto de partida. Se copia a la base la primera vez
 * y a partir de ahí manda la base. Está acá y no en un script de migración para
 * que una instalación nueva arranque con algo que mostrar en vez de con una
 * pantalla en blanco y un instructivo.
 */
export const CATALOGO_INICIAL: Record<Evento, Parte[]> = {
  quince: partesDe(
    MOMENTOS_QUINCE,
    "Elegí qué partes del día registramos y con qué. Cada momento se cotiza aparte, y adentro de cada uno elegís si va foto, video o las dos.",
  ),
  boda: partesDe(
    MOMENTOS_BODA,
    "Una boda son varios actos en un día. Elegí cuáles cubrimos y con qué: cada uno se cotiza aparte, y adentro elegís si va foto, video o las dos.",
  ),
};

/** Un ítem por id, dentro de un catálogo ya resuelto. */
export function itemDe(partes: Parte[], id: string): Item | null {
  for (const parte of partes) {
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
  /** Para el book: qué locación se eligió. Una sola, por id de ítem. */
  locaciones: Record<string, string>;
  /** Con qué se cubre cada momento. Varias, por id de ítem. */
  coberturas: Record<string, string[]>;
};

export const SELECCION_VACIA: Seleccion = {
  items: [],
  locaciones: {},
  coberturas: {},
};

/**
 * La selección que dio origen a estas líneas.
 *
 * Es el camino de vuelta: un presupuesto guardado se abre en el wizard tal como
 * lo dejó su dueño. Los ítems que ya no estén en el catálogo se caen solos al
 * recalcular, así que no hay que filtrarlos acá.
 *
 * Las coberturas viajan como líneas propias colgadas del ítem —por eso traen
 * `bajo`— así que rearmarlas es agruparlas por su padre.
 */
export function seleccionDe(lineas: Linea[]): Seleccion {
  const locaciones: Record<string, string> = {};
  const coberturas: Record<string, string[]> = {};
  const items: string[] = [];

  for (const l of lineas) {
    if (l.bajo) {
      (coberturas[l.bajo] ??= []).push(l.opcion ?? l.id);
      continue;
    }
    items.push(l.id);
    if (l.locacion) locaciones[l.id] = l.locacion;
  }

  return { items, locaciones, coberturas };
}

/** Los ids de la selección que este catálogo todavía conoce. */
export function depurar(partes: Parte[], sel: Seleccion): Seleccion {
  const validos = new Set(partes.flatMap((p) => p.items.map((i) => i.id)));
  const soloConocidos = <T,>(mapa: Record<string, T>) =>
    Object.fromEntries(Object.entries(mapa).filter(([id]) => validos.has(id)));

  return {
    items: sel.items.filter((id) => validos.has(id)),
    locaciones: soloConocidos(sel.locaciones),
    coberturas: soloConocidos(sel.coberturas),
  };
}

/** Una línea del presupuesto, ya con el precio resuelto. */
export type Linea = {
  id: string;
  nombre: string;
  /** El nombre de la locación elegida, cuando la hay. Es lo que se muestra. */
  detalle?: string;
  /**
   * El id de la opción que esta línea representa —la locación elegida, o la
   * cobertura—. No se muestra nunca: está para poder rearmar la selección
   * exacta al reeditar un presupuesto guardado. Sin esto habría que adivinarla
   * a partir del nombre, que es lo único que cambia cuando alguien corrige una
   * mayúscula en el catálogo.
   */
  locacion?: string;
  opcion?: string;
  /**
   * De qué ítem cuelga, para las coberturas.
   *
   * Las coberturas van como líneas propias y no sumadas al precio del momento
   * porque el presupuesto impreso tiene que decir con qué se cubre cada cosa:
   * "la fiesta, con foto y video" es la mitad de lo que se está contratando, y
   * escondido dentro de un solo número no se lee.
   */
  bajo?: string;
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
export function lineasDe(partes: Parte[], sel: Seleccion): Linea[] {
  const elegidos = new Set(sel.items);
  const lineas: Linea[] = [];

  for (const parte of partes) {
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
        opcion: locacion?.id,
        precio: item.precio + (locacion?.extra ?? 0),
      });

      // Y debajo, con qué se cubre. En el orden del catálogo, igual que todo.
      const puestas = new Set(sel.coberturas[item.id] ?? []);
      for (const c of item.coberturas ?? []) {
        if (!puestas.has(c.id)) continue;
        lineas.push({
          // La clave lleva el ítem adentro: la misma cobertura puede estar en
          // varios momentos y cada una es una línea distinta del presupuesto.
          id: `${item.id}/${c.id}`,
          nombre: c.nombre,
          opcion: c.id,
          bajo: item.id,
          precio: c.extra,
        });
      }
    }
  }

  return lineas;
}

export function totalDe(lineas: Linea[]) {
  return lineas.reduce((suma, l) => suma + l.precio, 0);
}

/**
 * Lo mínimo que puede salir un ítem: el "desde" de su tarjeta.
 *
 * No es su `precio` a secas. Un momento con coberturas no se puede contratar
 * sin al menos una —lo exige `sinCobertura`, y lo hacen cumplir el wizard y el
 * servidor—, así que el piso incluye la más barata. Mostrar el precio pelado
 * era anunciar un número que nadie podía pagar: en la fiesta decía la mitad de
 * lo que costaba elegirla.
 *
 * Con las locaciones pasa lo mismo al revés: hay que elegir una, pero la más
 * barata puede no sumar nada, y entonces no mueve el piso. Se toma el mínimo y
 * la cuenta sale sola en los dos casos.
 *
 * Un complemento no tiene nada colgando, así que su piso es su precio.
 */
/**
 * Si esta línea tiene que mostrar su monto.
 *
 * Un momento no cobra nada por sí solo: lo que se paga son sus coberturas, que
 * van como líneas propias debajo. Escribirle "$0" al lado sería contestar una
 * pregunta que nadie hizo y encima daría la impresión de que algo salió mal.
 * Se calla el monto y las líneas de abajo hablan.
 *
 * Sólo aplica a las líneas madre. Una cobertura en cero sí muestra su cero: ahí
 * el número informa —esa cobertura no suma— en vez de sobrar.
 *
 * Cuando el momento trae una locación con extra, la línea deja de estar en cero
 * y el monto vuelve solo. Es lo correcto: eso sí se cobra en la línea.
 */
export function muestraMonto(linea: Linea) {
  return linea.precio !== 0 || linea.bajo !== undefined;
}

export function desdeDe(item: {
  precio: number;
  locaciones?: { extra: number }[];
  coberturas?: { extra: number }[];
}) {
  const minimo = (opciones: { extra: number }[] | undefined) =>
    opciones?.length ? Math.min(...opciones.map((o) => o.extra)) : 0;

  return item.precio + minimo(item.locaciones) + minimo(item.coberturas);
}

/**
 * Qué ítems elegidos todavía no dicen con qué se los cubre.
 *
 * Un momento sin foto ni video no es nada contratable: el equipo estaría ahí
 * parado. Sólo se le exige a los ítems que ofrecen coberturas —un complemento
 * no tiene con qué cubrirse— así que la regla sale del catálogo y no de una
 * lista de excepciones escrita al lado.
 */
export function sinCobertura(partes: Parte[], sel: Seleccion): Item[] {
  const elegidos = new Set(sel.items);
  const faltan: Item[] = [];

  for (const parte of partes) {
    for (const item of parte.items) {
      if (!elegidos.has(item.id)) continue;
      if (!item.coberturas?.length) continue;

      // Se cuentan las que el catálogo reconoce, no las que llegaron. Contando
      // lo que llega, mandar una cobertura que ya no existe pasaba el control
      // —el arreglo no estaba vacío— pero no producía ninguna línea, y el
      // momento terminaba cobrado sin nada que entregar, que es exactamente lo
      // que esta función tiene que impedir.
      const puestas = new Set(sel.coberturas[item.id] ?? []);
      if (!item.coberturas.some((c) => puestas.has(c.id))) faltan.push(item);
    }
  }

  return faltan;
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
export function reservaDe(total: number, p: Parametros) {
  if (total <= 0) return 0;
  // Nunca más que el total: en una contratación mínima, el piso podría
  // superarlo y quedaría un saldo negativo.
  return Math.min(
    total,
    Math.max(p.reservaMinimo, Math.round(total * p.reservaPorcentaje)),
  );
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

export function cierreDe(total: number, planId: string, p: Parametros): Cierre {
  const plan = planDe(planId) ?? PLANES[1]!;
  const reserva = reservaDe(total, p);
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
  teaser:
    "Una caja con regalos nuestros y de las marcas con las que trabajamos. No decimos qué trae.",
  desbloqueada: "Va con tu contratación. Te la entregamos el día del evento.",
};

export function progresoBox(total: number, p: Parametros) {
  const umbral = p.boxUmbral;
  const falta = Math.max(0, umbral - total);
  return {
    falta,
    abierta: falta === 0,
    /** De 0 a 1, para la barra. */
    parte: Math.min(1, umbral > 0 ? total / umbral : 1),
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
