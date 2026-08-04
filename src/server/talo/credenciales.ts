import "server-only";

import { env } from "~/env";
import { db } from "~/server/db";
import type { CredencialesTalo } from "./types";

/**
 * De qué cuenta de Talo sale cada operación.
 *
 * Igual que en Mercado Pago, las credenciales viven en la `CuentaPago` del socio.
 * Si el grupo no tiene una de Talo asignada —o no hay ninguna cargada— se cae a
 * las del entorno, que es como funcionaba antes: así una instalación existente
 * sigue andando sin tocar nada.
 */

/**
 * Credenciales de mentira, para cuando no hay a quién autenticarse.
 *
 * El mock no sale a la red: exigirle credenciales sería pedir las llaves de una
 * puerta que no se abre. Pasa en dos casos —el sistema entero en modo simulado,
 * o un grupo puntual marcado de prueba— y en los dos el pago se confirma contra
 * el simulador, no contra Talo.
 */
function simuladas(): CredencialesTalo {
  return {
    clientId: "demo",
    clientSecret: "demo",
    userId: "demo",
    apiUrl: env.TALO_API_URL,
    cacheId: "demo",
  };
}

function siEsSimulado(): CredencialesTalo | null {
  return env.TALO_MODE === "real" ? null : simuladas();
}

function delEntorno(): CredencialesTalo | null {
  if (!env.TALO_CLIENT_ID || !env.TALO_CLIENT_SECRET || !env.TALO_USER_ID) {
    return null;
  }
  return {
    clientId: env.TALO_CLIENT_ID,
    clientSecret: env.TALO_CLIENT_SECRET,
    userId: env.TALO_USER_ID,
    apiUrl: env.TALO_API_URL,
    cacheId: "entorno",
  };
}

function deCuenta(cuenta: {
  id: string;
  proveedor: string;
  credencial: string;
  apiUrl: string | null;
  taloClientId: string | null;
  taloUserId: string | null;
}): CredencialesTalo | null {
  if (cuenta.proveedor !== "TALO") return null;
  if (!cuenta.taloClientId || !cuenta.taloUserId || !cuenta.credencial) {
    return null;
  }
  return {
    clientId: cuenta.taloClientId,
    clientSecret: cuenta.credencial,
    userId: cuenta.taloUserId,
    apiUrl: cuenta.apiUrl ?? env.TALO_API_URL,
    cacheId: cuenta.id,
  };
}

/** Las credenciales con las que cobra un grupo. */
export async function credencialesDeGrupo(
  grupoId: string,
): Promise<CredencialesTalo | null> {
  const simulado = siEsSimulado();
  if (simulado) return simulado;

  const grupo = await db.grupo.findUnique({
    where: { id: grupoId },
    include: { cuentaPago: true },
  });

  // Un grupo de prueba cobra contra el simulador aunque Talo esté en real, así
  // que no necesita credenciales de nadie. Sin esto, ensayar un cobro exigiría
  // tener cargada una cuenta real — justo lo que el modo prueba evita.
  if (grupo?.modoPrueba) return simuladas();

  const propia = grupo?.cuentaPago?.activa
    ? deCuenta(grupo.cuentaPago)
    : null;
  if (propia) return propia;

  const porDefecto = await db.cuentaPago.findFirst({
    where: { porDefecto: true, activa: true, proveedor: "TALO" },
  });
  if (porDefecto) {
    const cred = deCuenta(porDefecto);
    if (cred) return cred;
  }

  return delEntorno();
}

/**
 * Las credenciales de la cuenta dueña del CVU de un alumno.
 *
 * Es lo que hay que usar para confirmar un pago: el customer vive en la cuenta
 * de Talo que lo creó, y preguntarle a otra da "no encontrado". Se resuelve por
 * el grupo del alumno, que es de donde salió cuando se lo dio de alta.
 */
export async function credencialesDeAlumno(
  alumnoId: string,
): Promise<CredencialesTalo | null> {
  const simulado = siEsSimulado();
  if (simulado) return simulado;

  const alumno = await db.alumno.findUnique({
    where: { id: alumnoId },
    select: { grupoId: true },
  });
  if (!alumno) return delEntorno();

  return credencialesDeGrupo(alumno.grupoId);
}
