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
