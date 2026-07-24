import "server-only";

import { db } from "./db";
import { imputarPagos, sumarPagos } from "./dominio";

/**
 * Galerías de entrega: el material privado de cada familia.
 *
 * La regla de acceso es la misma que la que libera la galería en el panel: se
 * ve cuando la cuota está saldada. Acá esa regla se aplica del lado del
 * servidor, en el punto donde se sirve el archivo, no sólo en la pantalla —
 * porque esconder un botón no protege un archivo.
 */

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
  quien: { cuentaId?: string | null; token?: string | null; esAdmin?: boolean },
) {
  const galeria = await db.galeria.findUnique({ where: { id: galeriaId } });
  if (!galeria) return false;

  if (quien.esAdmin) return true;

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
