/**
 * Las categorías de la vitrina, como dato puro.
 *
 * Vive acá y no en `~/server/contenido` a propósito: ese módulo importa Prisma,
 * y si un componente de cliente lo tocara para leer esta lista se arrastraría
 * la base entera al bundle del navegador. Estos son datos, no tienen servidor.
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
