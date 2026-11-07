import "server-only";

import { Resolver } from "node:dns/promises";

import type { WebhookEventPayload } from "resend";

import type { TipoNotificacion } from "../../generated/prisma";
import { FRENADO } from "~/app/_datos/correo";
import { env } from "~/env";
import { fecha } from "~/lib/format";
import { leerCorreo } from "./correo-ajustes";
import { db } from "./db";

/**
 * Lo que se mira antes de mandar un correo, para no mandarlo al vacío.
 *
 * Un correo a un dominio que no existe vuelve como rebote, y los rebotes son lo
 * que más rápido hunde la reputación de un dominio: Resend pausa la cuenta
 * pasado el 4%. En noviembre de 2026 había nueve familias con el dominio mal
 * escrito ("gmail.con", "hotmail.comn") y todos los avisos a Halley iban a
 * admin@halleyproducciones.com, un dominio que no está registrado: 955 avisos
 * en dos meses que no le llegaron a nadie.
 */

/**
 * Un resolvedor propio con tiempos cortos. El de fábrica reintenta varias veces
 * con cinco segundos cada vez, y un DNS lento no puede frenar el link para
 * entrar de una familia que está esperando con el teléfono en la mano.
 */
const resolvedor = new Resolver({ timeout: 2500, tries: 2 });

/**
 * Lo que ya se averiguó, para no preguntar lo mismo con cada correo: un envío
 * en masa repite gmail.com cuatrocientas veces. Si el DNS no contestó se
 * guarda poco, para volver a preguntar pronto.
 */
const memoria = new Map<string, { recibe: boolean | null; hasta: number }>();
const VIDA = 6 * 60 * 60 * 1000;
const VIDA_SIN_RESPUESTA = 5 * 60 * 1000;

/**
 * Si el dominio puede recibir correo.
 *
 * `null` es "no se pudo saber": el DNS no contestó a tiempo. Ahí el correo
 * sale igual, porque frenar un comprobante por un problema de red de este lado
 * sería peor que el rebote que se quería evitar.
 */
export async function dominioRecibe(dominio: string): Promise<boolean | null> {
  const d = dominio.trim().toLowerCase().replace(/\.$/, "");
  const guardado = memoria.get(d);
  if (guardado && guardado.hasta > Date.now()) return guardado.recibe;

  const recibe = await consultar(d);
  memoria.set(d, {
    recibe,
    hasta: Date.now() + (recibe === null ? VIDA_SIN_RESPUESTA : VIDA),
  });
  return recibe;
}

async function consultar(dominio: string): Promise<boolean | null> {
  try {
    const mx = await resolvedor.resolveMx(dominio);
    // Un único MX vacío es la forma estándar de decir "acá no se recibe
    // correo" (RFC 7505).
    if (mx.length === 1 && (mx[0]?.exchange ?? "") === "") return false;
    if (mx.length > 0) return true;
  } catch (e) {
    if (!noExiste(e)) return null;
  }

  // Sin MX, el correo se entrega a la dirección del dominio mismo (RFC 5321).
  // Es raro, pero un dominio así sí recibe.
  for (const buscar of [
    () => resolvedor.resolve4(dominio),
    () => resolvedor.resolve6(dominio),
  ]) {
    try {
      if ((await buscar()).length > 0) return true;
    } catch (e) {
      if (!noExiste(e)) return null;
    }
  }
  return false;
}

/** El DNS contestó, y lo que contestó es que no hay nada. */
function noExiste(e: unknown) {
  const codigo = (e as { code?: string } | null)?.code;
  return codigo === "ENOTFOUND" || codigo === "ENODATA";
}

/**
 * Por qué no hay que mandarle a esta dirección, o `null` si se puede.
 *
 * Los motivos empiezan con `FRENADO`: así la bandeja distingue lo que frenó
 * Halley de lo que rechazó Resend, que se lee distinto.
 */
export async function motivoParaNoMandar(
  email: string,
  tipo: TipoNotificacion,
) {
  const dominio = email.split("@")[1]?.trim();
  if (!dominio) return `${FRENADO}: la dirección no tiene dominio.`;

  const bloqueo = await db.direccionBloqueada.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (bloqueo?.motivo === "rebote") {
    return `${FRENADO}: esta dirección rebotó el ${fecha(bloqueo.creadoEn)}${bloqueo.detalle ? ` ("${bloqueo.detalle}")` : ""}. No existe o no acepta correo.`;
  }
  if (bloqueo?.motivo === "queja" && TIPOS_MASIVOS.includes(tipo)) {
    return `${FRENADO}: esta familia marcó un correo de Halley como spam el ${fecha(bloqueo.creadoEn)}. Se le sigue mandando lo que pide (el link para entrar, los comprobantes), pero no invitaciones ni recordatorios.`;
  }

  if ((await dominioRecibe(dominio)) === false) {
    return `${FRENADO}: el dominio ${dominio} no recibe correo. Seguramente la dirección está mal escrita.`;
  }
  return null;
}

/**
 * Los correos que salen en masa, y no porque la familia hizo algo.
 *
 * A quien marcó un correo como spam no se le mandan más de éstos. Los otros sí:
 * el link para entrar lo pidió ella misma, y el comprobante es de un pago que
 * hizo; cortárselos sería dejarla afuera de su propia cuenta.
 */
export const TIPOS_MASIVOS: TipoNotificacion[] = [
  "INVITACION",
  "RECORDATORIO",
  "VALORACION",
];

/**
 * Para contar antes de un envío en masa: si una dirección va a recibir.
 *
 * Carga los bloqueos una sola vez. La vista previa de un envío a tres colegios
 * mira mil direcciones, y una consulta por cada una haría esperar al que
 * eligió los colegios.
 */
export async function filtroMasivo() {
  const bloqueadas = new Map(
    (await db.direccionBloqueada.findMany()).map((b) => [b.email, b.motivo]),
  );
  return async (
    email: string,
  ): Promise<"ok" | "rebota" | "queja" | "no-recibe"> => {
    const e = email.trim().toLowerCase();
    const motivo = bloqueadas.get(e);
    if (motivo === "rebote") return "rebota";
    if (motivo === "queja") return "queja";
    if ((await dominioRecibe(e.split("@")[1] ?? "")) === false)
      return "no-recibe";
    return "ok";
  };
}

/* ---------------------------------------------------------- remitentes */

/**
 * Desde qué dirección sale cada tipo de correo.
 *
 * Son dos y no uno porque los correos no valen lo mismo. El link para entrar y
 * el comprobante de un pago no pueden caer en spam; una invitación a un colegio
 * entero es el tipo de correo que más quejas junta. Con remitentes en dominios
 * distintos, un mal día de los masivos no se lleva puestos a los otros.
 *
 * Sin nada elegido en el panel, los dos salen de `EMAIL_FROM`, como siempre.
 * Sin remitente propio para los masivos, salen del de avisos.
 */
export async function remitentes() {
  const { remitenteAvisos, remitenteMasivos } = await leerCorreo();
  const avisos = remitenteAvisos || env.EMAIL_FROM;
  return { avisos, masivos: remitenteMasivos || avisos };
}

export async function remitentePara(tipo: TipoNotificacion) {
  const r = await remitentes();
  return TIPOS_MASIVOS.includes(tipo) ? r.masivos : r.avisos;
}

/* ------------------------------------------------- avisos de entrega */

/**
 * Anota una dirección para no escribirle más.
 *
 * Un rebote pisa a una queja y no al revés: si la dirección no existe da igual
 * que antes la hayan marcado como spam, no se le puede mandar nada.
 */
async function bloquear(
  email: string,
  motivo: "rebote" | "queja",
  detalle: string | null,
) {
  const e = email.trim().toLowerCase();
  const previo = await db.direccionBloqueada.findUnique({
    where: { email: e },
  });
  if (previo?.motivo === "rebote" && motivo === "queja") return;
  await db.direccionBloqueada.upsert({
    where: { email: e },
    create: { email: e, motivo, detalle: detalle?.slice(0, 300) ?? null },
    update: { motivo, detalle: detalle?.slice(0, 300) ?? null },
  });
}

/**
 * Lo que Resend cuenta que pasó con un correo después de aceptarlo.
 *
 * Sin esto "Enviado" sólo quiere decir que Resend lo tomó: no se sabe si llegó,
 * si rebotó o si alguien lo marcó como spam, y son justo los dos números que
 * deciden si Resend pausa la cuenta. Los eventos se aplican por el id del
 * correo; si llega dos veces el mismo, escribe lo mismo dos veces.
 */
export async function registrarEventoDeEntrega(evento: WebhookEventPayload) {
  if (!evento.type.startsWith("email.")) return { aplicado: false };
  const data = evento.data as { email_id: string; to?: string[] };
  const cuando = new Date(evento.created_at);
  const para = data.to?.[0] ?? null;
  const donde = { resendId: data.email_id };

  switch (evento.type) {
    case "email.delivered":
      await db.notificacion.updateMany({
        where: donde,
        data: { entregadoEl: cuando },
      });
      break;

    case "email.bounced": {
      const { bounce } = evento.data;
      await db.notificacion.updateMany({
        where: donde,
        data: { rebotadoEl: cuando, detalleEntrega: bounce.message },
      });
      // Los temporales (casilla llena, servidor caído) se reintentan solos y no
      // dicen nada de la dirección. Sólo el permanente la marca.
      if (bounce.type === "Permanent" && para)
        await bloquear(para, "rebote", bounce.message);
      break;
    }

    case "email.complained":
      await db.notificacion.updateMany({
        where: donde,
        data: { quejaEl: cuando },
      });
      if (para) await bloquear(para, "queja", null);
      break;

    case "email.suppressed": {
      const { suppressed } = evento.data;
      await db.notificacion.updateMany({
        where: donde,
        data: {
          rebotadoEl: cuando,
          detalleEntrega:
            `Resend no lo mandó: la dirección está en su lista de supresión. ${suppressed.message}`.trim(),
        },
      });
      if (para) {
        await bloquear(
          para,
          /complain/i.test(suppressed.type) ? "queja" : "rebote",
          suppressed.message,
        );
      }
      break;
    }

    case "email.delivery_delayed":
      await db.notificacion.updateMany({
        where: { ...donde, entregadoEl: null },
        data: {
          detalleEntrega:
            "Demorado: el servidor del destinatario todavía no lo aceptó. Resend sigue intentando.",
        },
      });
      break;

    case "email.failed":
      // Resend lo había aceptado y después no lo pudo mandar: deja de contar
      // como enviado, en la bandeja y en el medidor del cupo.
      await db.notificacion.updateMany({
        where: donde,
        data: { enviadoEl: null, errorEnvio: evento.data.failed.reason },
      });
      break;

    default:
      return { aplicado: false };
  }
  return { aplicado: true };
}
