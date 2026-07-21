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

export type ResultadoEnvio =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

export async function enviarEmail(mensaje: {
  para: string;
  asunto: string;
  texto: string;
}): Promise<ResultadoEnvio> {
  const api = resend();
  if (!api) {
    return { ok: false, error: "RESEND_API_KEY no configurada" };
  }

  try {
    const { data, error } = await api.emails.send({
      from: env.EMAIL_FROM,
      to: mensaje.para,
      subject: mensaje.asunto,
      text: mensaje.texto,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
