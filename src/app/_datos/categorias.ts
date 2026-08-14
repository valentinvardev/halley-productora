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

/**
 * La portada del sitio. No es una categoría de servicio —no sale como panel ni
 * tiene galería—, pero guarda su pieza en la misma tabla y usa la misma subida.
 */
export const HERO = "hero";

export type CategoriaSlug = (typeof CATEGORIAS)[number]["slug"];

export function esCategoria(slug: string): slug is CategoriaSlug {
  return CATEGORIAS.some((c) => c.slug === slug);
}

/**
 * Las fotos del catálogo del simulador de presupuesto.
 *
 * Tampoco es una categoría de la vitrina —no sale como panel ni tiene galería—
 * pero guarda sus piezas en la misma tabla, y eso es lo que permite que el
 * editor del catálogo ofrezca elegir una foto ya subida en vez de obligar a
 * volver a subir la misma.
 */
export const PRESUPUESTO = "presupuesto";

/** Lo que se puede subir: las cuatro categorías, el hero y el presupuesto. */
export function esSubible(slug: string) {
  return slug === HERO || slug === PRESUPUESTO || esCategoria(slug);
}
