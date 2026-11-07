import { env } from "~/env";
import { leerCorreo } from "~/server/correo-ajustes";
import { clienteResend } from "~/server/email";
import { registrarEventoDeEntrega } from "~/server/entrega";

/**
 * Webhook de Resend: qué pasó con cada correo después de que Resend lo aceptó.
 *
 * Es una puerta abierta a internet, y lo único que la cuida es la firma: sin
 * ella cualquiera podría marcar como rebotada la dirección de una familia y
 * dejarla sin correos. Por eso se verifica sobre el cuerpo crudo, antes de
 * leerlo como JSON: parsear y volver a armar el texto cambia los bytes y la
 * firma deja de cerrar.
 *
 * El trabajo es corto (una o dos escrituras), así que se hace antes de
 * contestar. Resend reintenta lo que no recibe un 200, y reaplicar un evento
 * escribe lo mismo otra vez.
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { webhookSecreto } = await leerCorreo();
  const secreto = webhookSecreto || env.RESEND_WEBHOOK_SECRET;
  const api = clienteResend();
  if (!secreto || !api) {
    return Response.json(
      { error: "avisos de entrega sin configurar" },
      { status: 503 },
    );
  }

  const cuerpo = await req.text();
  let evento;
  try {
    evento = api.webhooks.verify({
      payload: cuerpo,
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secreto,
    });
  } catch {
    return Response.json({ error: "firma inválida" }, { status: 401 });
  }

  try {
    await registrarEventoDeEntrega(evento);
  } catch (error) {
    // Un 500 hace que Resend reintente, que es lo que se quiere si la base
    // estuvo caída un momento.
    console.error("[resend] no se pudo registrar el evento:", error);
    return Response.json({ error: "no se pudo registrar" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
