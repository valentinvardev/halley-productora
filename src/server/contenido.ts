import { db } from "~/server/db";

/**
 * La vitrina: el contenido que el admin sube por categoría y que muestra la
 * landing.
 *
 * Las categorías son las mismas cuatro de los servicios. Se listan acá para que
 * el panel sepa qué carpetas ofrecer aunque todavía no tengan nada subido.
 */
export const CATEGORIAS = [
  { slug: "egresados", nombre: "Egresados" },
  { slug: "bodas", nombre: "Bodas" },
  { slug: "quince", nombre: "Quince años" },
  { slug: "marcas", nombre: "Marcas" },
] as const;

export type CategoriaSlug = (typeof CATEGORIAS)[number]["slug"];

export function esCategoria(slug: string): slug is CategoriaSlug {
  return CATEGORIAS.some((c) => c.slug === slug);
}

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
