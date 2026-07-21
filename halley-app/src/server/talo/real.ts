import { env } from "~/env";
import type {
  CrearCustomerInput,
  TaloClient,
  TaloCustomer,
  TaloTransaction,
} from "./types";

/**
 * Cliente contra la Customers API de Talo.
 *
 * ATENCIÓN: escrito según la especificación pero todavía sin probar contra la
 * API real — la cuenta comercial de Halley está pendiente de KYC. Los nombres
 * de los campos de respuesta hay que confirmarlos con la documentación de Talo
 * antes de pasar TALO_MODE a "real".
 */

function config() {
  if (!env.TALO_API_URL || !env.TALO_API_KEY) {
    throw new Error(
      "TALO_MODE=real requiere TALO_API_URL y TALO_API_KEY configuradas.",
    );
  }
  return { url: env.TALO_API_URL, key: env.TALO_API_KEY };
}

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  const { url, key } = config();
  const res = await fetch(`${url}${ruta}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Talo ${ruta} respondió ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export const taloReal: TaloClient = {
  async crearCustomer(input: CrearCustomerInput): Promise<TaloCustomer> {
    const data = await pedir<{ cvu: string; alias: string }>("/customers/", {
      method: "POST",
      body: JSON.stringify({
        customer_id: input.customerId,
        name: input.nombre,
        contact: { email: input.email },
        alias: input.aliasSugerido,
        webhook_url: input.webhookUrl,
      }),
    });

    return {
      customerId: input.customerId,
      cvu: data.cvu,
      alias: data.alias,
    };
  },

  async obtenerTransaccion(
    customerId: string,
    transactionId: string,
  ): Promise<TaloTransaction | null> {
    const data = await pedir<{
      amount: number;
      currency: string;
      created_at: string;
    }>(`/customers/${customerId}/transactions/${transactionId}`);

    return {
      transactionId,
      customerId,
      monto: data.amount,
      moneda: "ARS",
      creadoEn: new Date(data.created_at),
    };
  },
};
