import { randomUUID } from "node:crypto";

import { db } from "~/server/db";
import type {
  CredencialesTalo,
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

function normalizar(texto: string, largo: number) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, largo);
}

/**
 * Cuánto podemos proponer de alias.
 *
 * Verificado contra la API real: Talo le antepone el prefijo de la cuenta
 * ("halley27.", 9 caracteres) a lo que le mandemos y trunca el total a 20. Lo
 * que sobra se pierde, así que proponer algo largo no da un alias largo: da uno
 * cortado —y dos alumnos del mismo colegio terminarían cortados igual, chocando
 * entre sí—.
 */
const LARGO_ALIAS = 11;

/**
 * El alias que se le propone a Talo: el nombre de pila y unas letras al azar.
 *
 * El azar no es capricho: con once caracteres no alcanza para que "colegio +
 * nombre" sea único, y el alias sí tiene que serlo. Así queda reconocible —se
 * lee el nombre— y no choca con el del hermano ni con el de otro Fernando.
 */
export function armarAlias(_colegio: string, nombre: string) {
  const primerNombre = normalizar(nombre.trim().split(/\s+/)[0] ?? "pago", 7);
  const sufijo = randomUUID().replace(/[^a-z0-9]/g, "").slice(0, 4);
  return `${primerNombre}${sufijo}`.slice(0, LARGO_ALIAS);
}

async function aliasDisponible(alias: string) {
  const existe = await db.alumno.findFirst({
    where: { alias },
    select: { id: true },
  });
  return !existe;
}

/**
 * Prefijo que Talo le pone a todo alias de esta cuenta. Acá está fijo sólo para
 * que la demo muestre un alias con la misma forma que el de producción; el real
 * lo pone Talo y sale de la configuración de la cuenta.
 */
const PREFIJO = "halley27.";
const LARGO_TOTAL = 20;

export const taloMock: TaloClient = {
  async crearCustomer(
    _cred: CredencialesTalo,
    input: CrearCustomerInput,
  ): Promise<TaloCustomer> {
    // Se imita lo que hace Talo de verdad: antepone el prefijo de la cuenta y
    // corta a 20. Si el mock no cortara, la demo mostraría alias que en
    // producción no existirían.
    const armar = (base: string) =>
      `${PREFIJO}${base}`.slice(0, LARGO_TOTAL);

    let alias = armar(input.aliasSugerido);
    let intento = 1;
    while (!(await aliasDisponible(alias))) {
      intento += 1;
      alias = armar(`${input.aliasSugerido}${intento}`);
    }

    return {
      customerId: input.customerId,
      cvu: generarCvu(input.customerId),
      alias,
    };
  },

  async obtenerTransaccion(
    _cred: CredencialesTalo,
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
