import "server-only";

import { db } from "./db";

/**
 * Las cuentas que reciben cobros.
 *
 * Cada socio puede tener la suya, en Talo o en Mercado Pago, y cada grupo se
 * rutea a una. Sin cuenta elegida, cobra la que está marcada por defecto; sin
 * ninguna marcada, la app sigue andando con la configuración del entorno, que
 * es lo que había antes de que esto existiera.
 *
 * La credencial nunca sale de acá. El panel ve `pista` —los últimos cuatro
 * caracteres— que alcanza para reconocer cuál es sin poder usarla.
 */

export type Proveedor = "TALO" | "MERCADOPAGO";

export const PROVEEDORES: { valor: Proveedor; etiqueta: string }[] = [
  { valor: "TALO", etiqueta: "Talo" },
  { valor: "MERCADOPAGO", etiqueta: "Mercado Pago" },
];

/** Lo único de una credencial que puede ver el navegador. */
export function pistaDe(credencial: string) {
  const limpia = credencial.trim();
  if (limpia.length <= 4) return "····";
  return `····${limpia.slice(-4)}`;
}

/** Las cuentas, sin credenciales. Es lo que consume el panel. */
export async function listarCuentas() {
  const filas = await db.cuentaPago.findMany({
    orderBy: [{ porDefecto: "desc" }, { creadoEn: "asc" }],
    include: { _count: { select: { grupos: true } } },
  });

  return filas.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    proveedor: c.proveedor as Proveedor,
    pista: pistaDe(c.credencial),
    apiUrl: c.apiUrl,
    activa: c.activa,
    porDefecto: c.porDefecto,
    grupos: c._count.grupos,
  }));
}

/**
 * La cuenta que cobra por un grupo: la suya, o la de por defecto, o ninguna.
 *
 * Devuelve la credencial porque la usan los adaptadores de pago; sólo se llama
 * desde el servidor.
 */
export async function cuentaDeGrupo(grupoId: string) {
  const grupo = await db.grupo.findUnique({
    where: { id: grupoId },
    include: { cuentaPago: true },
  });

  if (grupo?.cuentaPago?.activa) return grupo.cuentaPago;

  return db.cuentaPago.findFirst({
    where: { porDefecto: true, activa: true },
  });
}

/**
 * Marca una cuenta como la de por defecto y saca la marca de las demás.
 *
 * Va en una transacción porque el estado intermedio —dos cuentas por defecto, o
 * ninguna— es justo el que no queremos que vea un cobro que entre en el medio.
 */
export async function marcarPorDefecto(id: string) {
  await db.$transaction([
    db.cuentaPago.updateMany({
      where: { porDefecto: true },
      data: { porDefecto: false },
    }),
    db.cuentaPago.update({ where: { id }, data: { porDefecto: true } }),
  ]);
}
