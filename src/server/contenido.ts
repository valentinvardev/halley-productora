import { after } from "next/server";

import { HERO as HERO_SLUG } from "~/app/_datos/categorias";
import { db } from "~/server/db";
import { BYTES_DE_ENCABEZADO, medidasDeBuffer } from "~/server/medidas-imagen";
import { primerosBytes, s3Configurado } from "~/server/s3";

// La lista de categorías es dato puro y vive aparte para que el cliente pueda
// leerla sin arrastrar Prisma. Se re-exporta para los consumidores de servidor
// que ya la buscaban acá.
export {
  CATEGORIAS,
  HERO,
  esCategoria,
  esSubible,
  type CategoriaSlug,
} from "~/app/_datos/categorias";

/**
 * La vitrina: el contenido que el admin sube por categoría y que muestra la
 * landing.
 *
 * <lo de abajo es sólo el helper que toca la base>
 */

/**
 * Las piezas de una categoría, en orden. Cada una se sirve por su propia URL
 * estable —`/api/contenido/{id}`—, que redirige a una URL firmada fresca: así
 * el `<img>` no cambia entre renders y el objeto de S3 no queda público.
 */
export async function contenidoDe(categoria: string) {
  const filas = await db.contenido.findMany({
    where: { categoria },
    orderBy: [{ orden: "asc" }, { creadoEn: "asc" }],
  });

  // Las que todavía no tienen medidas se miden solas, después de contestar.
  medirLoQueFalte(filas);

  return filas.map((c) => ({
    id: c.id,
    // En la base es texto libre; acá vuelve al par que consume la UI.
    tipo: c.tipo === "video" ? ("video" as const) : ("imagen" as const),
    url: `/api/contenido/${c.id}`,
    // Para las grillas, donde la pieza se dibuja del tamaño de una estampilla.
    // Las que se subieron antes de que existieran las miniaturas no tienen, y
    // ahí se cae al archivo grande: se ve igual, sólo que pesa lo que pesaba.
    urlMini: c.s3KeyMini
      ? `/api/contenido/${c.id}?m=1`
      : `/api/contenido/${c.id}`,
    // Para reservarle el lugar a cada foto antes de que llegue. Las viejas
    // vienen en null hasta que la medición de fondo las alcanza.
    ancho: c.ancho,
    alto: c.alto,
    likes: c.likes,
    // Para la página de videos. Las fotos también los tienen en la base,
    // pero hoy nadie se los pinta.
    titulo: c.titulo,
    descripcion: c.descripcion,
  }));
}

/**
 * Le completa las medidas a las piezas que no las tienen.
 *
 * Va con `after`, así que corre una vez despachada la respuesta: el que entró a
 * mirar la vitrina no espera por esto. La primera visita a una categoría la deja
 * medida y las siguientes no hacen nada, porque ya no queda ninguna sin medir.
 *
 * Es el reemplazo de un script de migración. Un script habría que acordarse de
 * correrlo, y correrlo de nuevo el día que aparezca una pieza vieja traída de
 * otro lado; esto se ocupa solo y no deja nada que recordar.
 *
 * Mide la miniatura y no el original: pesa cuarenta veces menos y tiene la
 * misma forma, que es lo único que se busca. Los videos quedan afuera porque
 * sus medidas no se leen así, y la vitrina igual los dibuja en 16:9.
 */
function medirLoQueFalte(
  filas: {
    id: string;
    tipo: string;
    s3Key: string;
    s3KeyMini: string | null;
    ancho: number | null;
  }[],
) {
  const faltan = filas.filter((c) => c.tipo !== "video" && c.ancho === null);
  if (faltan.length === 0 || !s3Configurado()) return;

  // `after` sólo existe dentro de un pedido. Hoy las dos páginas que llegan acá
  // son dinámicas, así que siempre lo hay; el seguro es para el día que llame un
  // script o un render de build, donde medir importa menos que no romper.
  try {
    after(medir);
  } catch {
    // Sin pedido no hay medición, y la vitrina sigue andando sin ella.
  }

  async function medir() {
    for (const c of faltan) {
      const bytes = await primerosBytes(
        c.s3KeyMini ?? c.s3Key,
        BYTES_DE_ENCABEZADO,
      );
      const m = bytes ? medidasDeBuffer(bytes) : null;
      if (!m) continue;
      // Si dos visitas coinciden, las dos escriben lo mismo. Y si la pieza se
      // borró en el medio, esto se cae solo y no hay nada que arreglar.
      await db.contenido
        .update({ where: { id: c.id }, data: { ancho: m.ancho, alto: m.alto } })
        .catch(() => undefined);
    }
  }
}

/**
 * La pieza de portada del sitio, o null si todavía no se subió ninguna. Hay una
 * sola: subir otra reemplaza a la anterior.
 */
export async function contenidoHero() {
  const fila = await db.contenido.findFirst({
    where: { categoria: HERO_SLUG },
    orderBy: { creadoEn: "desc" },
  });
  if (!fila) return null;
  return {
    id: fila.id,
    tipo: fila.tipo === "video" ? ("video" as const) : ("imagen" as const),
    url: `/api/contenido/${fila.id}`,
  };
}

/* ------------------------------------------------------------- aleatoriedad */

/**
 * Baraja una copia. Fisher-Yates: cada orden posible sale con la misma
 * probabilidad, a diferencia del `sort(() => Math.random() - 0.5)` que se ve por
 * ahí y que reparte muy desparejo.
 */
function mezclar<T>(items: T[]): T[] {
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia;
}

/**
 * Una muestra al azar de una categoría, distinta en cada visita.
 *
 * La landing es `force-dynamic`, así que esto se resuelve por pedido: quien
 * vuelve a entrar ve otras fotos y la vitrina no se siente siempre igual con el
 * mismo material.
 *
 * Si hay menos piezas que las pedidas, devuelve las que haya —no repite para
 * llenar, que se nota feo—.
 */
export async function muestraDe(categoria: string, cuantas: number) {
  const todas = await contenidoDe(categoria);
  return mezclar(todas).slice(0, cuantas);
}

/**
 * El fondo de la portada, elegido al azar entre lo que el admin haya subido a
 * la categoría del hero.
 *
 * Antes era siempre el último que se subía. Con varios clips cargados, cada
 * visita abre con uno distinto.
 */
export async function heroAleatorio() {
  const filas = await db.contenido.findMany({
    where: { categoria: HERO_SLUG },
  });
  const elegida = mezclar(filas)[0];
  if (!elegida) return null;
  return {
    id: elegida.id,
    tipo: elegida.tipo === "video" ? ("video" as const) : ("imagen" as const),
    url: `/api/contenido/${elegida.id}`,
  };
}
