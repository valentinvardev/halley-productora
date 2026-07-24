import "server-only";

import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import type { Galeria } from "../../generated/prisma";
import { db } from "./db";
import { imputarPagos, sumarPagos } from "./dominio";

/**
 * Galerías. En dos modos, con dos formas de entrar:
 *
 * - Atadas a un grupo: material de entrega de una familia, liberado al saldar
 *   el plan.
 * - Nativas: galerías sueltas que se comparten por su propio link, con
 *   contraseña opcional y vencimiento.
 *
 * En los dos, el permiso se chequea del lado del servidor en el punto donde se
 * sirve el archivo, no sólo en la pantalla —porque esconder un botón no protege
 * un archivo—.
 */

/* --------------------------------------------------- contraseñas y vigencia */

/** Hash de contraseña con scrypt y sal aleatoria: `salHex:hashHex`. */
export function hashPassword(plano: string) {
  const sal = randomBytes(16);
  const hash = scryptSync(plano, sal, 32);
  return `${sal.toString("hex")}:${hash.toString("hex")}`;
}

/** Verifica una contraseña contra el `salHex:hashHex` guardado. */
export function verificarPassword(plano: string, guardado: string) {
  const [salHex, hashHex] = guardado.split(":");
  if (!salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const calculado = scryptSync(plano, Buffer.from(salHex, "hex"), 32);
  return (
    esperado.length === calculado.length &&
    timingSafeEqual(esperado, calculado)
  );
}

/**
 * La prueba de que alguien acertó la contraseña de una galería, para guardar en
 * una cookie. Deriva del hash —que es secreto del servidor y trae sal—, así que
 * el cliente no la puede fabricar, y cambia si se cambia la contraseña,
 * invalidando los accesos viejos.
 */
export function pruebaDesbloqueo(galeria: {
  id: string;
  passwordHash: string | null;
}) {
  return createHash("sha256")
    .update(`${galeria.id}::${galeria.passwordHash ?? ""}`)
    .digest("hex");
}

/** ¿La galería sigue vigente? Las nativas siempre tienen fecha de vencimiento. */
export function galeriaVigente(galeria: { venceEl: Date | null }) {
  return !galeria.venceEl || galeria.venceEl.getTime() > Date.now();
}

/** ¿Este alumno (de este grupo) está al día? Es la llave de la galería. */
async function alumnoAlDia(alumnoId: string) {
  const alumno = await db.alumno.findUnique({
    where: { id: alumnoId },
    include: { grupo: { include: { cuotas: true } }, pagos: true },
  });
  if (!alumno) return null;
  const plan = imputarPagos(alumno.grupo.cuotas, sumarPagos(alumno.pagos));
  return { grupoId: alumno.grupoId, alDia: plan.deuda <= 0 };
}

/**
 * ¿Puede quien pide ver esta galería?
 *
 * Vale por dos caminos, los mismos por los que la familia entra a todo lo
 * demás: la sesión de una cuenta responsable de un alumno del grupo, o el token
 * del link personal de un alumno del grupo. En ambos, el alumno tiene que estar
 * al día.
 */
export async function puedeVerGaleria(
  galeriaId: string,
  quien: {
    cuentaId?: string | null;
    token?: string | null;
    esAdmin?: boolean;
    /** Galería nativa: el secreto del link (?g=…). */
    tokenGaleria?: string | null;
    /** Galería nativa con contraseña: el valor de la cookie de desbloqueo. */
    desbloqueoCookie?: string | null;
  },
) {
  const galeria = await db.galeria.findUnique({ where: { id: galeriaId } });
  if (!galeria) return false;

  if (quien.esAdmin) return true;

  // Galería nativa: entra quien tiene el link, mientras esté vigente y —si tiene
  // contraseña— la haya acertado. No hay cobro de por medio.
  if (!galeria.grupoId) {
    if (!galeriaVigente(galeria)) return false;
    if (!galeria.tokenPublico || quien.tokenGaleria !== galeria.tokenPublico) {
      return false;
    }
    if (galeria.passwordHash) {
      return quien.desbloqueoCookie === pruebaDesbloqueo(galeria);
    }
    return true;
  }

  // Por token del link personal.
  if (quien.token) {
    const alumno = await db.alumno.findUnique({
      where: { token: quien.token },
      select: { id: true, grupoId: true },
    });
    if (alumno?.grupoId === galeria.grupoId) {
      const estado = await alumnoAlDia(alumno.id);
      if (estado?.alDia) return true;
    }
  }

  // Por sesión: la cuenta es responsable de algún alumno del grupo que esté al día.
  if (quien.cuentaId) {
    const alumnos = await db.alumno.findMany({
      where: {
        grupoId: galeria.grupoId,
        tutores: { some: { cuentaId: quien.cuentaId } },
      },
      select: { id: true },
    });
    for (const a of alumnos) {
      const estado = await alumnoAlDia(a.id);
      if (estado?.alDia) return true;
    }
  }

  return false;
}

/** Las fotos de una galería, para el visor. La URL apunta a la ruta con permiso. */
export async function fotosDeGaleria(galeriaId: string) {
  const fotos = await db.fotoGaleria.findMany({
    where: { galeriaId },
    orderBy: [{ orden: "asc" }, { creadoEn: "asc" }],
  });
  return fotos.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    tipo: f.tipo === "video" ? ("video" as const) : ("imagen" as const),
    /** Ver en el navegador (firmada, con permiso). */
    url: `/api/galeria/${f.id}`,
    /** Bajar con el nombre original. */
    descarga: `/api/galeria/${f.id}?descargar=1`,
  }));
}

/* --------------------------------------------------------- galerías nativas */

/** Una galería nativa por su token de link. Null si no existe o no es nativa. */
export async function galeriaNativaPorToken(token: string) {
  const galeria = await db.galeria.findUnique({
    where: { tokenPublico: token },
  });
  if (!galeria || galeria.grupoId) return null;
  return galeria;
}

/**
 * Las fotos de una galería nativa, con el token del link pegado a cada URL: es
 * lo que la ruta pide para servirlas. Se llama sólo después de haber chequeado
 * el acceso (vigencia y contraseña).
 */
export async function fotosDeGaleriaNativa(galeria: Galeria) {
  const fotos = await db.fotoGaleria.findMany({
    where: { galeriaId: galeria.id },
    orderBy: [{ orden: "asc" }, { creadoEn: "asc" }],
  });
  const g = galeria.tokenPublico ?? "";
  return fotos.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    tipo: f.tipo === "video" ? ("video" as const) : ("imagen" as const),
    url: `/api/galeria/${f.id}?g=${g}`,
    descarga: `/api/galeria/${f.id}?descargar=1&g=${g}`,
  }));
}

/** El nombre de la cookie de desbloqueo de una galería nativa con contraseña. */
export function cookieDesbloqueo(galeriaId: string) {
  return `galn_${galeriaId}`;
}
