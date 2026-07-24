import type {
  CrearPreferenciaInput,
  MercadoPagoClient,
  PagoMP,
  Preferencia,
} from "./types";

/**
 * Cliente contra la API de Mercado Pago (Checkout Pro).
 *
 * El token es el del socio dueño de la cuenta: viaja en cada llamada, no es
 * global. Escrito según la referencia de MP; probado contra la API el día que
 * un socio conecte una cuenta real y `MP_MODE` pase a "real".
 */

const BASE = "https://api.mercadopago.com";

async function pedir<T>(
  accessToken: string,
  ruta: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${ruta}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(
      `Mercado Pago ${ruta} respondió ${res.status}: ${await res.text()}`,
    );
  }
  return (await res.json()) as T;
}

/** El estado de MP, traducido a los tres que nos importan. */
function traducirEstado(status: string): PagoMP["estado"] {
  if (status === "approved") return "aprobado";
  if (status === "rejected" || status === "cancelled") return "rechazado";
  return "pendiente";
}

export const mercadoPagoReal: MercadoPagoClient = {
  async crearPreferencia(
    accessToken: string,
    input: CrearPreferenciaInput,
  ): Promise<Preferencia> {
    const data = await pedir<{ id: string; init_point: string }>(
      accessToken,
      "/checkout/preferences",
      {
        method: "POST",
        body: JSON.stringify({
          items: [
            {
              title: input.descripcion,
              quantity: 1,
              unit_price: input.monto,
              currency_id: "ARS",
            },
          ],
          external_reference: input.referenciaExterna,
          back_urls: {
            success: input.urlRetorno,
            failure: input.urlRetorno,
            pending: input.urlRetorno,
          },
          auto_return: "approved",
          notification_url: input.urlWebhook,
          ...(input.emailPagador
            ? { payer: { email: input.emailPagador } }
            : {}),
        }),
      },
    );

    return { preferenciaId: data.id, urlPago: data.init_point };
  },

  async obtenerPago(
    accessToken: string,
    pagoId: string,
  ): Promise<PagoMP | null> {
    const data = await pedir<{
      status: string;
      transaction_amount: number;
      external_reference: string | null;
      date_approved: string | null;
      date_created: string;
    }>(accessToken, `/v1/payments/${pagoId}`);

    return {
      pagoId,
      estado: traducirEstado(data.status),
      monto: data.transaction_amount,
      referenciaExterna: data.external_reference,
      creadoEn: new Date(data.date_approved ?? data.date_created),
    };
  },
};
