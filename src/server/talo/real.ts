import { tokenTalo } from "./auth";
import type {
  CredencialesTalo,
  CrearCustomerInput,
  TaloClient,
  TaloCustomer,
  TaloTransaction,
} from "./types";

/**
 * Cliente contra la API de Talo.
 *
 * Verificado contra la API real: la autenticación es un token de una hora que
 * sale de canjear client_id + client_secret (ver `auth.ts`), y toda respuesta
 * viene envuelta en `data`.
 *
 * El customer es la sub-cuenta de cada alumno: Talo le da un CVU y un alias
 * propios, y avisa por webhook cada transferencia que entra ahí. Eso es lo que
 * permite imputar sin ambigüedad aunque dos hermanos paguen desde el mismo
 * banco.
 */

/** Todas las respuestas de Talo tienen esta forma. */
type Sobre<T> = { data?: T; message?: string; error?: boolean; code?: number };

async function pedir<T>(
  cred: CredencialesTalo,
  ruta: string,
  init?: RequestInit,
): Promise<T> {
  const token = await tokenTalo(cred);
  const res = await fetch(`${cred.apiUrl}${ruta}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  const json = (await res.json().catch(() => null)) as Sobre<T> | null;

  if (!res.ok || json?.error) {
    throw new Error(
      `Talo ${ruta} respondió ${res.status}: ${json?.message ?? "sin detalle"}`,
    );
  }
  if (!json?.data) throw new Error(`Talo ${ruta} no devolvió datos`);
  return json.data;
}

export const taloReal: TaloClient = {
  async crearCustomer(
    cred: CredencialesTalo,
    input: CrearCustomerInput,
  ): Promise<TaloCustomer> {
    // `user_id` es obligatorio: dice bajo qué cuenta de Talo cuelga el customer.
    const data = await pedir<{
      customer_id: string;
      bank_info?: { cvu?: string; alias?: string };
    }>(cred, "/customers/", {
      method: "POST",
      body: JSON.stringify({
        user_id: cred.userId,
        customer_id: input.customerId,
        name: input.nombre,
        alias: input.aliasSugerido,
        contact: { email: input.email },
        webhook_url: input.webhookUrl,
      }),
    });

    const cvu = data.bank_info?.cvu;
    const alias = data.bank_info?.alias;
    if (!cvu || !alias) {
      throw new Error("Talo creó el customer pero no devolvió CVU/alias");
    }

    return { customerId: data.customer_id ?? input.customerId, cvu, alias };
  },

  async obtenerTransaccion(
    cred: CredencialesTalo,
    customerId: string,
    transactionId: string,
  ): Promise<TaloTransaction | null> {
    try {
      const data = await pedir<{
        amount?: number | string;
        currency?: string;
        creation_timestamp?: string;
        created_at?: string;
      }>(cred, `/customers/${customerId}/transactions/${transactionId}`);

      const monto = Number(data.amount);
      if (!Number.isFinite(monto)) return null;

      return {
        transactionId,
        customerId,
        monto,
        moneda: "ARS",
        creadoEn: new Date(
          data.creation_timestamp ?? data.created_at ?? Date.now(),
        ),
      };
    } catch (error) {
      // No encontrarla es una respuesta válida —el webhook puede llegar antes
      // de que la transacción esté consultable—, no un error a propagar.
      console.error(`[talo] no se pudo leer ${transactionId}:`, error);
      return null;
    }
  },
};
