import "server-only";

import { db } from "./db";

/**
 * Los ajustes del correo, guardados en la misma tabla clave/valor que el resto.
 *
 * Van aparte de `AJUSTES` a propósito: ésos se devuelven enteros al panel y se
 * editan con un formulario genérico, y acá vive el secreto que firma los
 * avisos de entrega de Resend, que no tiene por qué viajar al navegador nunca.
 */
const CLAVES = {
  plan: "correoPlan",
  remitenteAvisos: "correoRemitenteAvisos",
  remitenteMasivos: "correoRemitenteMasivos",
  webhookId: "resendWebhookId",
  webhookSecreto: "resendWebhookSecreto",
} as const;

export type ClaveCorreo = keyof typeof CLAVES;

export async function leerCorreo(): Promise<Record<ClaveCorreo, string>> {
  const filas = await db.ajuste.findMany({
    where: { clave: { in: Object.values(CLAVES) } },
  });
  const guardados = new Map(filas.map((f) => [f.clave, f.valor.trim()]));
  const salida = {} as Record<ClaveCorreo, string>;
  for (const [nombre, clave] of Object.entries(CLAVES)) {
    salida[nombre as ClaveCorreo] = guardados.get(clave) ?? "";
  }
  return salida;
}

export async function guardarCorreo(
  cambios: Partial<Record<ClaveCorreo, string>>,
) {
  await db.$transaction(
    Object.entries(cambios).map(([nombre, valor]) =>
      db.ajuste.upsert({
        where: { clave: CLAVES[nombre as ClaveCorreo] },
        create: { clave: CLAVES[nombre as ClaveCorreo], valor: valor ?? "" },
        update: { valor: valor ?? "" },
      }),
    ),
  );
}
