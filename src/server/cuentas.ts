import { randomBytes } from "node:crypto";

import { env } from "~/env";
import { db } from "./db";
import { MAX_RESPONSABLES } from "./dominio";

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

/**
 * Cuánto dura la sesión de una familia.
 *
 * Un año, y se renueva sola mientras se use. La idea es que el link por email
 * sea algo que se ve una vez: verifica que el email es de quien dice, y desde
 * ahí el dispositivo queda reconocido. Una familia que entra a mirar su cuota
 * cada tanto no vuelve a ver un link nunca.
 *
 * Lo que no se hace es dejar entrar sólo con el email: eso convertiría conocer
 * una dirección en poder ver el plan de pagos de esa familia y bajarse su
 * galería privada.
 */
const DIAS_SESION = 365;

/**
 * Cuándo conviene estirar una sesión que se está usando.
 *
 * Se renueva recién pasada la mitad de su vida, no en cada visita: escribir en
 * la base en cada pedido para mover una fecha que todavía tiene meses por
 * delante es puro costo.
 */
const RENOVAR_DESDE_DIAS = DIAS_SESION / 2;

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

/**
 * ¿Puede esta persona sumarse como responsable de este alumno?
 *
 * Vive acá y no en la acción de servidor para tener una sola implementación de
 * la regla: la usan el registro y cualquier otra puerta que se abra después.
 */
export async function puedeSumarResponsable(alumnoId: string, email: string) {
  const alumno = await db.alumno.findUnique({
    where: { id: alumnoId },
    include: { tutores: { include: { cuenta: true } } },
  });

  if (!alumno) return { ok: false as const, motivo: "no-existe" as const };

  // Quien ya es responsable siempre puede volver a entrar.
  const yaEs = alumno.tutores.some(
    (t) => t.cuenta.email === normalizarEmail(email),
  );
  if (yaEs) return { ok: true as const, alumno };

  if (alumno.tutores.length >= MAX_RESPONSABLES) {
    return { ok: false as const, motivo: "sin-lugar" as const, alumno };
  }

  return { ok: true as const, alumno };
}

/**
 * Abre la sesión: crea la cuenta si es la primera vez, la vincula al alumno que
 * se está reclamando y devuelve el token para la cookie.
 *
 * Es el punto común de los dos modos de acceso — el directo entra por acá y el
 * de enlace también, después de canjear el token.
 */
export async function abrirSesion(email: string, alumnoId?: string) {
  const cuenta = await db.cuenta.upsert({
    where: { email: normalizarEmail(email) },
    update: { ultimoAcceso: new Date() },
    create: { email: normalizarEmail(email), ultimoAcceso: new Date() },
  });

  // El vínculo se crea sólo si todavía queda lugar: entre que se pidió entrar
  // y se entró, otros pudieron haber ocupado los cupos.
  if (alumnoId) {
    const ocupados = await db.tutor.count({ where: { alumnoId } });
    if (ocupados < MAX_RESPONSABLES) {
      await db.tutor.upsert({
        where: { cuentaId_alumnoId: { cuentaId: cuenta.id, alumnoId } },
        update: {},
        create: { cuentaId: cuenta.id, alumnoId },
      });
    }
  }

  const sesion = await db.sesion.create({
    data: {
      token: tokenAleatorio(),
      cuentaId: cuenta.id,
      expiraEl: new Date(Date.now() + DIAS_SESION * 24 * 60 * 60 * 1000),
    },
  });

  return sesion.token;
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

  const [sesion] = await Promise.all([
    abrirSesion(enlace.email, enlace.alumnoId ?? undefined),
    db.enlaceAcceso.update({
      where: { id: enlace.id },
      data: { usadoEl: new Date() },
    }),
  ]);

  return { ok: true, sesion };
}

/**
 * Devuelve la cuenta de una sesión válida, o null. De paso la renueva si ya
 * pasó la mitad de su vida, para que quien sigue usando el panel no se quede
 * afuera de golpe un día.
 */
export async function cuentaDeSesion(token: string | undefined) {
  if (!token) return null;

  const sesion = await db.sesion.findUnique({
    where: { token },
    include: { cuenta: true },
  });

  if (!sesion || sesion.expiraEl.getTime() < Date.now()) return null;

  const faltan = sesion.expiraEl.getTime() - Date.now();
  if (faltan < RENOVAR_DESDE_DIAS * 24 * 60 * 60 * 1000) {
    // No se espera el resultado: renovar es una cortesía, no puede demorar la
    // pantalla ni tumbarla si falla.
    void db.sesion
      .update({
        where: { id: sesion.id },
        data: { expiraEl: new Date(Date.now() + DIAS_SESION * 24 * 60 * 60 * 1000) },
      })
      .catch(() => undefined);
  }

  return sesion.cuenta;
}

export async function cerrarSesion(token: string | undefined) {
  if (!token) return;
  await db.sesion.deleteMany({ where: { token } });
}
