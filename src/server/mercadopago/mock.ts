import { randomUUID } from "node:crypto";

import { env } from "~/env";
import { db } from "~/server/db";
import type {
  CrearPreferenciaInput,
  MercadoPagoClient,
  PagoMP,
  Preferencia,
} from "./types";

/**
 * Mercado Pago simulado.
 *
 * Reproduce el ida y vuelta de Checkout Pro sin plata real: al crear la
 * preferencia guarda el pago pendiente y devuelve como `urlPago` una pantalla
 * demo nuestra que hace de checkout de MP. Cuando esa pantalla confirma, el pago
 * queda aprobado y el webhook lo procesa igual que en producción.
 */

export const mercadoPagoMock: MercadoPagoClient = {
  async crearPreferencia(
    _accessToken: string,
    input: CrearPreferenciaInput,
  ): Promise<Preferencia> {
    // El id del pago se conoce desde el vamos (lo generamos nosotros), así la
    // pantalla demo puede confirmarlo. En MP real lo asigna ellos al pagar.
    const pagoId = `mp_${randomUUID()}`;

    // La cuenta que cobra viaja embebida en la urlWebhook, igual que en real.
    const cuentaPagoId =
      new URL(input.urlWebhook).searchParams.get("cuenta") ?? "";

    await db.transaccionMockMercadoPago.create({
      data: {
        id: pagoId,
        cuentaPagoId,
        referenciaExterna: input.referenciaExterna,
        monto: input.monto,
      },
    });

    const url = new URL(`${env.NEXT_PUBLIC_APP_URL}/pagar/mp-demo`);
    url.searchParams.set("pago", pagoId);
    url.searchParams.set("volver", input.urlRetorno);

    return { preferenciaId: pagoId, urlPago: url.toString() };
  },

  async obtenerPago(
    _accessToken: string,
    pagoId: string,
  ): Promise<PagoMP | null> {
    const tx = await db.transaccionMockMercadoPago.findUnique({
      where: { id: pagoId },
    });
    if (!tx) return null;

    return {
      pagoId: tx.id,
      // Sólo cuenta como aprobado si la pantalla demo lo confirmó.
      estado: tx.aprobadoEn ? "aprobado" : "pendiente",
      monto: Number(tx.monto),
      referenciaExterna: tx.referenciaExterna,
      creadoEn: tx.aprobadoEn ?? tx.creadoEn,
    };
  },
};

/**
 * Sólo en modo mock: marca un pago demo como aprobado, como si la familia
 * hubiese terminado de pagar en Mercado Pago. Devuelve la cuenta que cobra para
 * que el que llama dispare el procesamiento del webhook.
 */
export async function aprobarPagoMockMp(pagoId: string) {
  const tx = await db.transaccionMockMercadoPago.update({
    where: { id: pagoId },
    data: { aprobadoEn: new Date() },
  });
  return { cuentaPagoId: tx.cuentaPagoId, referenciaExterna: tx.referenciaExterna };
}
