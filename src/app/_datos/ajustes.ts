/**
 * Los campos de ajustes, como dato puro para el formulario del panel.
 *
 * Vive acá y no en `~/server/ajustes` porque ese módulo toca la base: si el
 * formulario —que es de cliente— lo importara, se arrastraría Prisma al bundle
 * del navegador. Los valores por defecto viven del lado del servidor; acá sólo
 * está lo que hace falta para dibujar el form.
 */

export const CAMPOS_AJUSTE = [
  {
    clave: "whatsapp",
    etiqueta: "WhatsApp",
    ayuda: "Sólo números, con código de país y área. Ej: 5493513000000",
    tipo: "text",
  },
  {
    clave: "instagram",
    etiqueta: "Instagram",
    ayuda: "La URL completa del perfil.",
    tipo: "url",
  },
  {
    clave: "mail",
    etiqueta: "Email de contacto",
    ayuda: "La casilla que se muestra en la web.",
    tipo: "email",
  },
] as const;

/**
 * Los sonidos disponibles para el aviso de cobro.
 *
 * Son tres tonos sintetizados, no muestras grabadas: pesan entre cinco y doce
 * kilobytes y no arrastran licencias.
 */
export const SONIDOS_PAGO = [
  { valor: "campana", etiqueta: "Campana" },
  { valor: "moneda", etiqueta: "Moneda" },
  { valor: "pulso", etiqueta: "Pulso" },
  { valor: "silencio", etiqueta: "Sin sonido" },
] as const;

export type ClaveAjusteUI = (typeof CAMPOS_AJUSTE)[number]["clave"];
