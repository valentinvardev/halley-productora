import { randomUUID } from "node:crypto";

import { db } from "~/server/db";
import type {
  CrearCustomerInput,
  TaloClient,
  TaloCustomer,
  TaloTransaction,
} from "./types";

/**
 * Talo simulado. Genera CVU/alias con la misma forma que la Customers API y
 * guarda las transferencias simuladas para que el webhook las confirme.
 */

/** CVU de 22 dígitos: 7 de entidad + 15 derivados del customer_id. */
function generarCvu(semilla: string) {
  let hash = 0;
  for (const char of semilla) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1_000_000_007;
  }
  const cuerpo = String(hash).padStart(15, "0").slice(0, 15);
  return `0000630${cuerpo}`;
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 12);
}

/** halley.sanmartin.fernando — el formato que muestra el sistema de diseño. */
export function armarAlias(colegio: string, nombre: string) {
  const primerNombre = nombre.trim().split(/\s+/)[0] ?? "padre";
  return `halley.${normalizar(colegio)}.${normalizar(primerNombre)}`;
}

async function aliasDisponible(alias: string) {
  const existe = await db.padre.findFirst({
    where: { alias },
    select: { id: true },
  });
  return !existe;
}

export const taloMock: TaloClient = {
  async crearCustomer(input: CrearCustomerInput): Promise<TaloCustomer> {
    // Talo rechaza alias repetidos: desambiguamos con un sufijo numérico.
    let alias = input.aliasSugerido;
    let intento = 1;
    while (!(await aliasDisponible(alias))) {
      intento += 1;
      alias = `${input.aliasSugerido}${intento}`;
    }

    return {
      customerId: input.customerId,
      cvu: generarCvu(input.customerId),
      alias,
    };
  },

  async obtenerTransaccion(
    customerId: string,
    transactionId: string,
  ): Promise<TaloTransaction | null> {
    const tx = await db.transaccionMockTalo.findUnique({
      where: { id: transactionId },
    });
    if (!tx || tx.customerId !== customerId) return null;

    return {
      transactionId: tx.id,
      customerId: tx.customerId,
      monto: Number(tx.monto),
      moneda: "ARS",
      creadoEn: tx.creadoEn,
    };
  },
};

/**
 * Sólo en modo mock: registra una transferencia entrante como si el padre
 * hubiese transferido desde su banco. Devuelve la transacción para que el
 * simulador dispare el webhook con su id.
 */
export async function registrarTransferenciaSimulada(
  customerId: string,
  monto: number,
): Promise<TaloTransaction> {
  const transactionId = `tx_${randomUUID()}`;
  const tx = await db.transaccionMockTalo.create({
    data: { id: transactionId, customerId, monto },
  });

  return {
    transactionId: tx.id,
    customerId: tx.customerId,
    monto: Number(tx.monto),
    moneda: "ARS",
    creadoEn: tx.creadoEn,
  };
}
