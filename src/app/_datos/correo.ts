/**
 * Datos del correo que necesitan las dos puntas: el servidor para medir y el
 * panel para dibujar el desplegable. Vive acá y no en `~/server` por lo mismo
 * que `ajustes.ts`: importarlo desde el cliente no tiene que arrastrar Prisma.
 */

/**
 * Los planes de envío de Resend.
 *
 * Son datos del proveedor: cambian el día que Resend cambia sus precios, no
 * por temporada. `dia` nulo es sin tope diario, que es lo que tienen todos los
 * planes pagos; el gratuito es el único que corta por día.
 */
export const PLANES_RESEND = [
  { valor: "gratis", etiqueta: "Gratis", mes: 3_000, dia: 100 },
  { valor: "pro", etiqueta: "Pro · 50.000 por mes", mes: 50_000, dia: null },
  {
    valor: "pro100",
    etiqueta: "Pro · 100.000 por mes",
    mes: 100_000,
    dia: null,
  },
  {
    valor: "scale",
    etiqueta: "Scale · 100.000 por mes",
    mes: 100_000,
    dia: null,
  },
] as const;

export type PlanResend = (typeof PLANES_RESEND)[number]["valor"];

export function planResend(valor: string | null | undefined) {
  return PLANES_RESEND.find((p) => p.valor === valor) ?? PLANES_RESEND[0];
}

/**
 * Con qué empieza el error de un correo que frenó Halley antes de mandarlo.
 * La bandeja lo usa para no decir "Resend rechazó" de algo que Resend nunca vio.
 */
export const FRENADO = "No salió";

export function frenadoPorHalley(error: string) {
  return error.startsWith(FRENADO);
}
