import { HERO as HERO_SLUG } from "~/app/_datos/categorias";
import { db } from "~/server/db";

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

  return filas.map((c) => ({
    id: c.id,
    // En la base es texto libre; acá vuelve al par que consume la UI.
    tipo: c.tipo === "video" ? ("video" as const) : ("imagen" as const),
    url: `/api/contenido/${c.id}`,
    // Para las grillas, donde la pieza se dibuja del tamaño de una estampilla.
    // Las que se subieron antes de que existieran las miniaturas no tienen, y
    // ahí se cae al archivo grande: se ve igual, sólo que pesa lo que pesaba.
    urlMini: c.s3KeyMini ? `/api/contenido/${c.id}?m=1` : `/api/contenido/${c.id}`,
  }));
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
  const filas = await db.contenido.findMany({ where: { categoria: HERO_SLUG } });
  const elegida = mezclar(filas)[0];
  if (!elegida) return null;
  return {
    id: elegida.id,
    tipo: elegida.tipo === "video" ? ("video" as const) : ("imagen" as const),
    url: `/api/contenido/${elegida.id}`,
  };
}
