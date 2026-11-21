import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { db } from "./db";
import {
  esperaRestante,
  origenDe,
  registrarExito,
  registrarFallo,
} from "./limite-intentos";

/**
 * La clave con la que un sistema de afuera (el bot de WhatsApp) entra a la API.
 *
 * Hay una sola a la vez. Se genera desde Ajustes, se muestra una única vez y
 * en la base queda sólo su huella (SHA-256): con la base en la mano no se
 * puede usar. Generar otra reemplaza a la anterior, que deja de andar en el
 * momento, así que perder la clave o sospechar que se filtró se arregla con un
 * botón y sin deploy.
 *
 * No se compara con bcrypt ni scrypt a propósito: esos sirven para contraseñas
 * que eligió una persona, que son cortas. Ésta son 32 bytes al azar; probarla
 * por fuerza bruta no termina nunca, y la huella rápida deja comparar en cada
 * pedido sin costo.
 */

const CLAVES = {
  huella: "apiClaveHuella",
  fin: "apiClaveFin",
  creadaEl: "apiClaveCreadaEl",
  usadaEl: "apiClaveUsadaEl",
} as const;

const PREFIJO = "hly_";

function huellaDe(clave: string) {
  return createHash("sha256").update(clave, "utf8").digest();
}

async function leer() {
  const filas = await db.ajuste.findMany({
    where: { clave: { in: Object.values(CLAVES) } },
  });
  const m = new Map(filas.map((f) => [f.clave, f.valor]));
  return {
    huella: m.get(CLAVES.huella) ?? "",
    fin: m.get(CLAVES.fin) ?? "",
    creadaEl: m.get(CLAVES.creadaEl) ?? "",
    usadaEl: m.get(CLAVES.usadaEl) ?? "",
  };
}

/** Lo que el panel puede ver de la clave: nunca la clave. */
export async function estadoClave() {
  const c = await leer();
  if (!c.huella) return null;
  return {
    fin: c.fin,
    creadaEl: c.creadaEl ? new Date(c.creadaEl) : null,
    usadaEl: c.usadaEl ? new Date(c.usadaEl) : null,
  };
}

/** Genera una clave nueva, reemplaza la anterior y la devuelve por única vez. */
export async function generarClave() {
  const clave = PREFIJO + randomBytes(32).toString("base64url");
  const valores = {
    [CLAVES.huella]: huellaDe(clave).toString("hex"),
    [CLAVES.fin]: clave.slice(-4),
    [CLAVES.creadaEl]: new Date().toISOString(),
    [CLAVES.usadaEl]: "",
  };
  await db.$transaction(
    Object.entries(valores).map(([clave, valor]) =>
      db.ajuste.upsert({
        where: { clave },
        create: { clave, valor },
        update: { valor },
      }),
    ),
  );
  return clave;
}

/** Revoca la clave: desde ahí la API contesta 401 a todo. */
export async function revocarClave() {
  await db.ajuste.deleteMany({
    where: { clave: { in: Object.values(CLAVES) } },
  });
}

/** Cada cuánto se anota el último uso. Anotarlo en cada pedido es escribir de más. */
const ANOTAR_USO_CADA_MS = 60_000;

export type Rechazo = { status: number; error: string; mensaje: string };

/**
 * Si el pedido trae la clave vigente. Devuelve `null` si pasa, o el rechazo
 * listo para contestar.
 *
 * Los fallos se cuentan por IP con el mismo freno que el login del panel: la
 * clave no se puede adivinar, pero sin freno un bucle con claves inventadas
 * es igual una forma de hacer trabajar a la base.
 */
export async function verificarClave(req: Request): Promise<Rechazo | null> {
  const llave = `api:${origenDe(req.headers)}`;
  const espera = esperaRestante(llave);
  if (espera > 0) {
    return {
      status: 429,
      error: "demasiados_intentos",
      mensaje: `Demasiados intentos con una clave inválida. Esperá ${espera} segundos.`,
    };
  }

  const encabezado = req.headers.get("authorization") ?? "";
  const dada = /^Bearer\s+(\S+)$/i.exec(encabezado)?.[1] ?? "";
  const c = await leer();

  if (!c.huella) {
    return {
      status: 401,
      error: "sin_clave",
      mensaje: "La API no tiene una clave generada. Se genera en el panel, en Ajustes.",
    };
  }

  const guardada = Buffer.from(c.huella, "hex");
  const ok =
    dada.startsWith(PREFIJO) &&
    guardada.length === 32 &&
    timingSafeEqual(huellaDe(dada), guardada);

  if (!ok) {
    registrarFallo(llave);
    return {
      status: 401,
      error: "clave_invalida",
      mensaje: "Falta la clave o no es la vigente. Va en el encabezado Authorization: Bearer <clave>.",
    };
  }

  registrarExito(llave);
  const ultima = c.usadaEl ? Date.parse(c.usadaEl) : 0;
  if (Date.now() - ultima > ANOTAR_USO_CADA_MS) {
    await db.ajuste.upsert({
      where: { clave: CLAVES.usadaEl },
      create: { clave: CLAVES.usadaEl, valor: new Date().toISOString() },
      update: { valor: new Date().toISOString() },
    });
  }
  return null;
}
