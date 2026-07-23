import { Resend } from "resend";

import { env } from "~/env";

/**
 * Envío real por Resend.
 *
 * La app nunca llama a esto directamente: pasa siempre por
 * `src/server/notificaciones.ts`, que registra el mensaje y después decide si
 * además hay que mandarlo. Con `EMAIL_MODE=bandeja` (el modo de la demo) esto
 * no se ejecuta.
 */

let cliente: Resend | null = null;

function resend() {
  if (!env.RESEND_API_KEY) return null;
  cliente ??= new Resend(env.RESEND_API_KEY);
  return cliente;
}

export const emailHabilitado =
  env.EMAIL_MODE === "resend" && !!env.RESEND_API_KEY;

/**
 * A dónde contesta la gente.
 *
 * El remitente es una dirección del dominio verificado, que muchas veces no
 * tiene casilla; sin esto, responder un aviso no le llega a nadie. Por defecto
 * cae en ADMIN_EMAIL, que ya es el buzón que Halley mira.
 */
export const responderA = env.EMAIL_REPLY_TO ?? env.ADMIN_EMAIL;

export type ResultadoEnvio =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

export async function enviarEmail(mensaje: {
  para: string;
  asunto: string;
  texto: string;
  /** Cara HTML. Se manda junto con el texto, que queda de fallback. */
  html?: string;
}): Promise<ResultadoEnvio> {
  const api = resend();
  if (!api) {
    return { ok: false, error: "RESEND_API_KEY no configurada" };
  }

  try {
    const { data, error } = await api.emails.send({
      from: env.EMAIL_FROM,
      to: mensaje.para,
      replyTo: responderA,
      subject: mensaje.asunto,
      text: mensaje.texto,
      ...(mensaje.html ? { html: mensaje.html } : {}),
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
