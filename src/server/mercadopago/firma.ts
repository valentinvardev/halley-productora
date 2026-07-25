import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "~/env";

/**
 * Firma de las notificaciones de Mercado Pago.
 *
 * MP manda `x-signature: ts=<epoch>,v1=<hmac>` y `x-request-id`. El hmac es
 * SHA-256 sobre una plantilla armada con el id del recurso, ese request-id y el
 * ts, usando como clave el secreto de la aplicación.
 *
 * No es lo único que nos protege —el pago siempre se vuelve a consultar contra
 * la API de MP con el token del socio, así que un aviso inventado no puede
 * fabricar plata—, pero es la primera barrera: sin esto, cualquiera puede
 * hacernos trabajar mandando avisos falsos, y el día que alguien confíe en el
 * contenido del webhook, la barrera ya está puesta.
 */

const TOLERANCIA_MS = 5 * 60 * 1000;

export function firmaConfigurada() {
  return Boolean(env.MP_WEBHOOK_SECRET);
}

type Resultado = { ok: true } | { ok: false; motivo: string };

/**
 * Verifica la firma de un aviso.
 *
 * `dataId` es el id del recurso tal como llega: MP lo pide en minúsculas cuando
 * es alfanumérico, y así lo arma su propia documentación.
 */
export function verificarFirma(opciones: {
  firma: string | null;
  requestId: string | null;
  dataId: string | null;
}): Resultado {
  const secreto = env.MP_WEBHOOK_SECRET;
  if (!secreto) return { ok: true }; // Sin secreto configurado no se exige.

  if (!opciones.firma) return { ok: false, motivo: "sin-firma" };

  // "ts=1704908010,v1=abc..." → partes sueltas.
  const partes = new Map(
    opciones.firma.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k?.trim() ?? "", v.join("=").trim()];
    }),
  );
  const ts = partes.get("ts");
  const v1 = partes.get("v1");
  if (!ts || !v1) return { ok: false, motivo: "firma-mal-formada" };

  // Una firma vieja es una repetición: alguien reenviando un aviso que grabó.
  const edad = Math.abs(Date.now() - Number(ts) * 1000);
  if (!Number.isFinite(edad) || edad > TOLERANCIA_MS) {
    return { ok: false, motivo: "firma-vencida" };
  }

  // La plantilla omite el tramo cuyo valor no vino.
  const id = opciones.dataId?.toLowerCase() ?? "";
  let plantilla = "";
  if (id) plantilla += `id:${id};`;
  if (opciones.requestId) plantilla += `request-id:${opciones.requestId};`;
  plantilla += `ts:${ts};`;

  const esperado = createHmac("sha256", secreto).update(plantilla).digest("hex");

  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(v1, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, motivo: "firma-invalida" };
  }

  return { ok: true };
}
