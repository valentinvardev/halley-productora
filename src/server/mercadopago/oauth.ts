import "server-only";

import { randomBytes } from "node:crypto";

import { env } from "~/env";
import { db } from "~/server/db";

/**
 * Vinculación de la cuenta de un socio por OAuth.
 *
 * En vez de que el socio nos pase su access token por privado —que obliga a
 * confiar en el canal y deja el secreto dando vueltas—, aprieta "Conectar con
 * Mercado Pago", autoriza en su propia cuenta y volvemos con un token emitido
 * para nosotros, que además se puede renovar y revocar desde su lado.
 *
 * Las credenciales que viajan acá son las de la aplicación de Halley
 * (MP_CLIENT_ID / MP_CLIENT_SECRET); las del socio nunca las vemos.
 */

const AUTORIZACION = "https://auth.mercadopago.com/authorization";
const TOKEN = "https://api.mercadopago.com/oauth/token";

/** El `state` dura lo que tarda una persona en autorizar, no más. */
const MINUTOS_ESTADO = 15;

/**
 * A dónde vuelve Mercado Pago. Tiene que ser fija y estar registrada igual en
 * la configuración de la aplicación, o MP rechaza el canje.
 */
export function urlDeRetorno() {
  return `${env.NEXT_PUBLIC_APP_URL}/api/oauth/mercadopago`;
}

export function oauthConfigurado() {
  return Boolean(env.MP_CLIENT_ID && env.MP_CLIENT_SECRET);
}

/**
 * Arranca la vinculación: guarda el `state` y devuelve la URL a la que hay que
 * mandar al socio.
 */
export async function urlDeAutorizacion(nombre: string) {
  if (!oauthConfigurado()) return null;

  const estado = randomBytes(32).toString("base64url");
  await db.estadoOauth.create({
    data: {
      estado,
      nombre,
      expiraEl: new Date(Date.now() + MINUTOS_ESTADO * 60 * 1000),
    },
  });

  const url = new URL(AUTORIZACION);
  url.searchParams.set("client_id", env.MP_CLIENT_ID!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", estado);
  url.searchParams.set("redirect_uri", urlDeRetorno());
  return url.toString();
}

/** Lo que devuelve Mercado Pago al canjear. Verificado contra la API real. */
type RespuestaToken = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  user_id: number;
  live_mode?: boolean;
};

async function pedirToken(cuerpo: Record<string, string>) {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.MP_CLIENT_ID,
      client_secret: env.MP_CLIENT_SECRET,
      ...cuerpo,
    }),
  });

  if (!res.ok) {
    // El cuerpo del error trae el motivo de MP, pero no lo propagamos hacia
    // afuera: puede incluir detalles de la aplicación.
    console.error(`[mp-oauth] ${res.status}: ${await res.text()}`);
    return null;
  }
  return (await res.json()) as RespuestaToken;
}

/**
 * Canjea el código por el token del socio y deja la cuenta creada.
 *
 * El `state` se valida acá: tiene que existir, no haber vencido y no haberse
 * usado. Se marca usado antes de canjear, así un reenvío del mismo callback no
 * vincula dos veces.
 */
export async function vincularConCodigo(codigo: string, estado: string) {
  const guardado = await db.estadoOauth.findUnique({ where: { estado } });
  if (!guardado) return { ok: false as const, motivo: "estado-invalido" };
  if (guardado.usadoEl) return { ok: false as const, motivo: "estado-usado" };
  if (guardado.expiraEl.getTime() < Date.now()) {
    return { ok: false as const, motivo: "estado-vencido" };
  }

  await db.estadoOauth.update({
    where: { id: guardado.id },
    data: { usadoEl: new Date() },
  });

  const datos = await pedirToken({
    grant_type: "authorization_code",
    code: codigo,
    redirect_uri: urlDeRetorno(),
  });
  if (!datos) return { ok: false as const, motivo: "canje-fallido" };

  const mpUserId = String(datos.user_id);
  const expiraEl = new Date(Date.now() + datos.expires_in * 1000);

  // Si esa cuenta de MP ya estaba vinculada, se actualizan sus tokens en vez de
  // crear una segunda entrada para el mismo vendedor.
  const existente = await db.cuentaPago.findUnique({ where: { mpUserId } });

  if (existente) {
    await db.cuentaPago.update({
      where: { id: existente.id },
      data: {
        credencial: datos.access_token,
        refreshToken: datos.refresh_token ?? existente.refreshToken,
        expiraEl,
        activa: true,
      },
    });
    return { ok: true as const, id: existente.id, revinculada: true };
  }

  // La primera cuenta que entra queda como la de por defecto: sin eso, no
  // cobraría nadie hasta que alguien se acuerde de marcarla.
  const hayAlguna = await db.cuentaPago.count({ where: { activa: true } });

  const cuenta = await db.cuentaPago.create({
    data: {
      nombre: guardado.nombre,
      proveedor: "MERCADOPAGO",
      credencial: datos.access_token,
      refreshToken: datos.refresh_token ?? null,
      expiraEl,
      mpUserId,
      activa: true,
      porDefecto: hayAlguna === 0,
    },
  });

  return { ok: true as const, id: cuenta.id, revinculada: false };
}

/** Margen para renovar antes de que el token quede corto. */
const MARGEN_MS = 24 * 60 * 60 * 1000;

/**
 * El access token de una cuenta, renovado si está por vencer.
 *
 * Todo lo que le pega a Mercado Pago tiene que pasar por acá y no leer
 * `credencial` directo: un token de OAuth vence a los 180 días y, sin esto, los
 * cobros de ese socio se cortarían un día sin aviso.
 */
export async function tokenVigente(cuenta: {
  id: string;
  credencial: string;
  refreshToken: string | null;
  expiraEl: Date | null;
}) {
  const vinculadaPorOauth = !!cuenta.refreshToken;
  if (!vinculadaPorOauth || !cuenta.expiraEl) return cuenta.credencial;

  const faltaPoco = cuenta.expiraEl.getTime() - Date.now() < MARGEN_MS;
  if (!faltaPoco) return cuenta.credencial;

  const datos = await pedirToken({
    grant_type: "refresh_token",
    refresh_token: cuenta.refreshToken!,
  });
  if (!datos) {
    // No se pudo renovar: se devuelve el que hay. Si ya venció, MP responderá
    // 401 y el error se verá en el cobro, que es donde hay que enterarse.
    console.error(`[mp-oauth] no se pudo renovar la cuenta ${cuenta.id}`);
    return cuenta.credencial;
  }

  await db.cuentaPago.update({
    where: { id: cuenta.id },
    data: {
      credencial: datos.access_token,
      refreshToken: datos.refresh_token ?? cuenta.refreshToken,
      expiraEl: new Date(Date.now() + datos.expires_in * 1000),
    },
  });

  return datos.access_token;
}
