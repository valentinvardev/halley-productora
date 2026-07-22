import { randomBytes } from "node:crypto";

import { env } from "~/env";
import { db } from "./db";

/**
 * Autenticación de padres: sólo email, sin contraseña.
 *
 * Se le manda un link con un token de un solo uso; al abrirlo se canjea por una
 * sesión guardada en una cookie httpOnly. No hay contraseñas que recordar,
 * filtrar ni resetear, y el email ya lo necesitábamos igual para avisar de los
 * pagos.
 */

export const COOKIE_SESION = "halley_sesion";

/** El link de acceso dura poco: es el momento más expuesto del sistema. */
const MINUTOS_ENLACE = 30;
const DIAS_SESION = 30;

function tokenAleatorio() {
  return randomBytes(32).toString("base64url");
}

export function normalizarEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Crea el enlace de acceso. Devuelve la URL completa para mandarla por email
 * (y para mostrarla en pantalla mientras estamos en modo demo sin envío real).
 */
export async function crearEnlaceAcceso(
  email: string,
  opciones?: { alumnoId?: string },
) {
  const enlace = await db.enlaceAcceso.create({
    data: {
      token: tokenAleatorio(),
      email: normalizarEmail(email),
      alumnoId: opciones?.alumnoId,
      expiraEl: new Date(Date.now() + MINUTOS_ENLACE * 60 * 1000),
    },
  });

  return {
    enlace,
    url: `${env.NEXT_PUBLIC_APP_URL}/acceso/${enlace.token}`,
    minutos: MINUTOS_ENLACE,
  };
}

export type ResultadoCanje =
  | { ok: true; sesion: string }
  | { ok: false; motivo: "invalido" | "vencido" | "usado" };

/**
 * Canjea el token del email por una sesión. De paso crea la cuenta si es la
 * primera vez y vincula el alumno que se estaba reclamando.
 */
export async function canjearEnlace(token: string): Promise<ResultadoCanje> {
  const enlace = await db.enlaceAcceso.findUnique({ where: { token } });

  if (!enlace) return { ok: false, motivo: "invalido" };
  if (enlace.usadoEl) return { ok: false, motivo: "usado" };
  if (enlace.expiraEl.getTime() < Date.now()) {
    return { ok: false, motivo: "vencido" };
  }

  const cuenta = await db.cuenta.upsert({
    where: { email: enlace.email },
    update: { ultimoAcceso: new Date() },
    create: { email: enlace.email, ultimoAcceso: new Date() },
  });

  // El alumno se vincula sólo si sigue libre: entre que se pidió el link y se
  // abrió, otra persona pudo haberlo reclamado.
  if (enlace.alumnoId) {
    await db.alumno.updateMany({
      where: { id: enlace.alumnoId, cuentaId: null },
      data: { cuentaId: cuenta.id },
    });
  }

  const [sesion] = await Promise.all([
    db.sesion.create({
      data: {
        token: tokenAleatorio(),
        cuentaId: cuenta.id,
        expiraEl: new Date(Date.now() + DIAS_SESION * 24 * 60 * 60 * 1000),
      },
    }),
    db.enlaceAcceso.update({
      where: { id: enlace.id },
      data: { usadoEl: new Date() },
    }),
  ]);

  return { ok: true, sesion: sesion.token };
}

/** Devuelve la cuenta de una sesión válida, o null. */
export async function cuentaDeSesion(token: string | undefined) {
  if (!token) return null;

  const sesion = await db.sesion.findUnique({
    where: { token },
    include: { cuenta: true },
  });

  if (!sesion || sesion.expiraEl.getTime() < Date.now()) return null;
  return sesion.cuenta;
}

export async function cerrarSesion(token: string | undefined) {
  if (!token) return;
  await db.sesion.deleteMany({ where: { token } });
}
