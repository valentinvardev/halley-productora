import "server-only";

import {
  CATALOGO_INICIAL,
  EVENTOS_ORDEN,
  PARAMETROS_POR_DEFECTO,
  MOMENTOS_COMBINABLES,
  type Evento,
  type Item,
  type Parametros,
  type Parte,
} from "~/app/_datos/presupuesto";
import { db } from "./db";

/**
 * El catálogo del simulador, leído de la base.
 *
 * Nació como una constante en el código y se mudó acá porque un precio no es
 * una decisión de programación: cambia por temporada y pedir un deploy para
 * tocarlo garantiza que quede viejo. Ahora se edita desde el panel.
 *
 * Este módulo es el único que sabe cómo están guardados los ítems. Lo que
 * devuelve es la misma forma que el simulador ya usaba —`Parte[]`, con sus
 * ítems y sus locaciones— así que del otro lado nada se enteró del cambio.
 *
 * Lo lee el wizard para pintar y el router para volver a sumar antes de
 * guardar. Que sea la misma función en los dos lados es lo que hace que el
 * total que se ve y el que se cobra no puedan diferir.
 */

/* ------------------------------------------------------------------- partes */

/**
 * Los encabezados de cada parte.
 *
 * No están en la base porque no son datos del negocio sino el texto de la
 * pantalla: cambiarlos es rediseñar el paso, no actualizar un precio. Lo que se
 * edita desde el panel son los ítems.
 */
const ENCABEZADOS = {
  momentos: {
    rotulo: "Parte 1",
    titulo: "Qué momentos cubrimos",
    bajada: {
      quince:
        "Elegí qué partes del día queremos registrar. Se pueden combinar, y cada una se cotiza aparte.",
      boda: "Una boda son varios actos en un día. Elegí cuáles cubrimos: se pueden combinar y cada uno se cotiza aparte.",
    },
    multiple: MOMENTOS_COMBINABLES,
  },
  coberturas: {
    rotulo: "Parte 2",
    titulo: "Con qué lo cubrimos",
    bajada: {
      quince:
        "Fotografía, video o las dos. Podés sumar todas las que quieras: cada una es un equipo más trabajando ese día.",
      boda: "Fotografía, video o las dos. Podés sumar todas las que quieras: cada una es un equipo más trabajando ese día.",
    },
    multiple: true,
  },
  complementos: {
    rotulo: "Parte 3",
    titulo: "Que no le falte nada",
    bajada: {
      quince:
        "Lo que se agrega sobre la cobertura. Nada de esto es obligatorio y todo se puede decidir después.",
      boda: "Lo que se agrega sobre la cobertura. Nada de esto es obligatorio y todo se puede decidir después.",
    },
    multiple: true,
  },
} as const;

export const PARTES = ["momentos", "coberturas", "complementos"] as const;

/* ------------------------------------------------------------------ imágenes */

/**
 * La URL con la que se sirve una imagen del catálogo.
 *
 * Es la misma ruta que usa la vitrina: `/api/contenido/{id}` redirige a una URL
 * firmada y fresca de S3, así que la key nunca sale al cliente y el bucket
 * sigue privado. `?m=1` pide la versión chica, que es la que se ve en una
 * tarjeta.
 *
 * Reusar la tabla de contenidos es lo que permite que el panel ofrezca elegir
 * algo ya subido en vez de obligar a volver a subir la misma foto.
 */
export function urlImagen(id: string | null | undefined) {
  return id ? `/api/contenido/${id}?m=1` : undefined;
}

/* ------------------------------------------------------------------ lectura */

type FilaItem = {
  id: string;
  clave: string;
  parte: string;
  nombre: string;
  texto: string;
  precio: unknown;
  imagenId: string | null;
  locaciones: {
    clave: string;
    nombre: string;
    texto: string;
    extra: unknown;
    imagenId: string | null;
  }[];
};

function armarItem(f: FilaItem): Item {
  return {
    // Hacia afuera el ítem se identifica por su clave y no por su id de base:
    // es lo que queda escrito en los presupuestos emitidos, así que tiene que
    // sobrevivir a que alguien renombre el ítem o lo borre y lo vuelva a crear.
    id: f.clave,
    nombre: f.nombre,
    texto: f.texto,
    precio: Number(f.precio),
    imagen: urlImagen(f.imagenId),
    ...(f.locaciones.length > 0
      ? {
          locaciones: f.locaciones.map((l) => ({
            id: l.clave,
            nombre: l.nombre,
            texto: l.texto,
            extra: Number(l.extra),
            imagen: urlImagen(l.imagenId),
          })),
        }
      : {}),
  };
}

/**
 * El catálogo de un evento.
 *
 * `soloActivos` es lo que separa las dos audiencias: el simulador ve lo que se
 * ofrece hoy, el panel ve todo —incluido lo apagado— porque para volver a
 * encender algo primero hay que poder verlo.
 */
export async function catalogoDe(
  evento: Evento,
  { soloActivos = true } = {},
): Promise<Parte[]> {
  await sembrarSiHaceFalta();

  const filas = await db.itemPresupuesto.findMany({
    where: { evento, ...(soloActivos ? { activo: true } : {}) },
    orderBy: [{ parte: "asc" }, { orden: "asc" }],
    include: { locaciones: { orderBy: { orden: "asc" } } },
  });

  return PARTES.map((parte) => {
    const cabeza = ENCABEZADOS[parte];
    return {
      id: parte,
      rotulo: cabeza.rotulo,
      titulo: cabeza.titulo,
      bajada: cabeza.bajada[evento],
      multiple: cabeza.multiple,
      items: filas.filter((f) => f.parte === parte).map(armarItem),
    };
  });
}

/* --------------------------------------------------------------- parámetros */

/**
 * Las perillas del flujo, guardadas en la misma tabla clave/valor que el resto
 * de lo que se cambia sin deploy.
 *
 * Van con su valor por defecto, así que el simulador funciona aunque nunca se
 * hayan tocado — que es el estado de una instalación recién hecha.
 */
export const CLAVES_PARAMETRO = {
  reservaPorcentaje: "presupuestoReservaPorcentaje",
  reservaMinimo: "presupuestoReservaMinimo",
  boxUmbral: "presupuestoBoxUmbral",
  preciosConfirmados: "presupuestoPreciosConfirmados",
} as const;

export async function parametrosPresupuesto(): Promise<Parametros> {
  const filas = await db.ajuste.findMany({
    where: { clave: { in: Object.values(CLAVES_PARAMETRO) } },
  });
  const guardados = new Map(filas.map((f) => [f.clave, f.valor]));

  const numero = (clave: string, porDefecto: number) => {
    const crudo = guardados.get(clave);
    if (crudo === undefined) return porDefecto;
    const n = Number(crudo);
    return Number.isFinite(n) ? n : porDefecto;
  };

  return {
    reservaPorcentaje: numero(
      CLAVES_PARAMETRO.reservaPorcentaje,
      PARAMETROS_POR_DEFECTO.reservaPorcentaje,
    ),
    reservaMinimo: numero(
      CLAVES_PARAMETRO.reservaMinimo,
      PARAMETROS_POR_DEFECTO.reservaMinimo,
    ),
    boxUmbral: numero(
      CLAVES_PARAMETRO.boxUmbral,
      PARAMETROS_POR_DEFECTO.boxUmbral,
    ),
    preciosConfirmados:
      (guardados.get(CLAVES_PARAMETRO.preciosConfirmados) ??
        (PARAMETROS_POR_DEFECTO.preciosConfirmados ? "si" : "no")) === "si",
  };
}

/* ------------------------------------------------------------------ siembra */

/**
 * Si la tabla está vacía, se copia el catálogo inicial.
 *
 * Va acá y no en un script de migración aparte para que no haya un paso manual
 * entre desplegar y tener el simulador andando: la primera visita lo siembra.
 * `skipDuplicates` es la red contra dos visitas simultáneas — la segunda no
 * duplica nada porque la clave está protegida por índice único.
 *
 * Se siembra una sola vez. Después manda la base, incluso si queda vacía porque
 * alguien borró todo a propósito: para eso está la bandera.
 */
const SEMBRADO = "presupuestoCatalogoSembrado";

/**
 * Ya se comprobó que está sembrado, en este proceso.
 *
 * Sin esto, cada lectura del catálogo se lleva una consulta extra para siempre
 * a preguntar algo cuya respuesta no puede volver atrás: una vez sembrado, lo
 * está. Arranca en falso en cada arranque del servidor, que es lo correcto —una
 * base nueva con un proceso viejo no existe—.
 */
let sembrado = false;

/**
 * La siembra en curso, si la hay.
 *
 * La página del simulador pide los dos catálogos en paralelo y cada uno llama
 * acá: sin esto, los dos arrancaban a sembrar a la vez y el segundo chocaba
 * contra el índice único a mitad de camino. Compartiendo la promesa, el segundo
 * espera al primero en vez de competirle.
 */
let sembrando: Promise<void> | null = null;

async function sembrarSiHaceFalta() {
  if (sembrado) return;
  sembrando ??= sembrar().finally(() => {
    sembrando = null;
  });
  return sembrando;
}

async function sembrar() {
  const marca = await db.ajuste.findUnique({ where: { clave: SEMBRADO } });
  if (marca) {
    sembrado = true;
    return;
  }

  for (const evento of EVENTOS_ORDEN) {
    for (const parte of CATALOGO_INICIAL[evento]) {
      for (const [i, item] of parte.items.entries()) {
        const creado = await db.itemPresupuesto
          .create({
            data: {
              evento,
              parte: parte.id,
              clave: item.id,
              nombre: item.nombre,
              texto: item.texto,
              precio: item.precio,
              orden: i,
            },
          })
          .catch(() => null);

        if (!creado || !item.locaciones) continue;

        await db.locacionPresupuesto.createMany({
          data: item.locaciones.map((l, j) => ({
            itemId: creado.id,
            clave: l.id,
            nombre: l.nombre,
            texto: l.texto,
            extra: l.extra,
            orden: j,
          })),
          skipDuplicates: true,
        });
      }
    }
  }

  // Que la marca ya exista no es un error: quiere decir que otro proceso
  // terminó de sembrar mientras éste trabajaba, y el resultado es el mismo.
  await db.ajuste
    .upsert({
      where: { clave: SEMBRADO },
      create: { clave: SEMBRADO, valor: new Date().toISOString() },
      update: {},
    })
    .catch(() => undefined);

  sembrado = true;
}

/** Para el panel: fuerza la siembra sin tener que entrar al simulador. */
export const sembrarCatalogo = sembrarSiHaceFalta;
