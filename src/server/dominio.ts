import { env } from "~/env";

/**
 * Reglas de negocio compartidas entre routers, webhook y páginas.
 */

type ConMonto = { montoCuota: unknown };

/** El monto del padre manda; si no tiene override, vale el del grupo. */
export function montoDe(padre: ConMonto | null, grupo: ConMonto): number {
  const propio = padre?.montoCuota;
  if (propio !== null && propio !== undefined) return Number(propio);
  return Number(grupo.montoCuota);
}

/**
 * El estado que se muestra. `VENCIDO` no se persiste: se deriva de la fecha,
 * así el panel no depende de que haya corrido un cron para decir la verdad.
 */
export function estadoVisible(
  estado: "PENDIENTE" | "PAGADO" | "VENCIDO",
  venceEl: Date,
): "PENDIENTE" | "PAGADO" | "VENCIDO" {
  if (estado === "PAGADO") return "PAGADO";
  return venceEl.getTime() < Date.now() ? "VENCIDO" : "PENDIENTE";
}

export function linkPadre(token: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/p/${token}`;
}

export function linkGrupo(slug: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/g/${slug}`;
}
