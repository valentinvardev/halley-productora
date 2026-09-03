import "server-only";

import { randomBytes } from "node:crypto";

import { env } from "~/env";

import { destinatarios } from "./alumnos";
import { db } from "./db";
import { notificarValoracion } from "./notificaciones";

/**
 * Valoraciones después del servicio.
 *
 * El admin las pide desde la ficha del alumno; la familia recibe un mail con un
 * link; el link abre un formulario con nombre, comentario, estrellas y una foto
 * opcional; lo que llega queda esperando a que el admin lo publique, y recién
 * ahí sale en la portada.
 *
 * El link dura una semana y sirve una sola vez, con la misma mecánica que el
 * de acceso: la fila nace con el pedido, y usar el link es completar esa misma
 * fila. Así no hay forma de que una valoración llegue sin que alguien la haya
 * pedido.
 */

const DIAS = 7;

function tokenAleatorio() {
  return randomBytes(32).toString("base64url");
}

export function linkValoracion(token: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/valorar/${token}`;
}

/**
 * Pide la valoración a la familia de un alumno.
 *
 * A los responsables registrados, o al contacto si no hay ninguno: la misma
 * regla que la invitación. Cada dirección recibe su propio link, porque el
 * link es de un solo uso y dos personas no pueden compartirlo.
 */
export async function pedirValoracion(alumnoId: string) {
  const alumno = await db.alumno.findUniqueOrThrow({
    where: { id: alumnoId },
    include: { grupo: true, tutores: { include: { cuenta: true } } },
  });
  const emails = destinatarios(alumno);
  if (emails.length === 0) return { enviados: 0 };

  let enviados = 0;
  for (const email of emails) {
    const fila = await db.valoracion.create({
      data: {
        token: tokenAleatorio(),
        alumnoId: alumno.id,
        grupoId: alumno.grupoId,
        email,
        expiraEl: new Date(Date.now() + DIAS * 24 * 3600 * 1000),
      },
    });
    await notificarValoracion({
      alumno,
      grupo: alumno.grupo,
      email,
      link: linkValoracion(fila.token),
    });
    enviados += 1;
  }
  return { enviados };
}

export type MotivoLink = "invalido" | "usado" | "vencido";

/** El link, si todavía sirve, con lo que el formulario necesita saber. */
export async function abrirValoracion(token: string) {
  const fila = await db.valoracion.findUnique({
    where: { token },
    include: { alumno: true, grupo: true },
  });
  if (!fila) return { ok: false as const, motivo: "invalido" as const };
  if (fila.usadoEl) return { ok: false as const, motivo: "usado" as const };
  if (fila.expiraEl.getTime() < Date.now()) {
    return { ok: false as const, motivo: "vencido" as const };
  }
  return {
    ok: true as const,
    id: fila.id,
    alumno: fila.alumno?.nombre ?? "",
    grupo: fila.grupo?.nombre ?? "",
  };
}

/**
 * Completa la valoración y consume el link.
 *
 * Las dos cosas en la misma escritura: si el link se marcara como usado antes
 * de guardar el texto, un corte en el medio dejaría un link muerto y una
 * valoración vacía.
 */
export async function enviarValoracion(
  token: string,
  datos: {
    nombre: string;
    comentario: string;
    estrellas: number;
    fotoKey?: string | null;
  },
) {
  const abierta = await abrirValoracion(token);
  if (!abierta.ok) return abierta;
  await db.valoracion.update({
    where: { id: abierta.id },
    data: {
      nombre: datos.nombre,
      comentario: datos.comentario,
      estrellas: datos.estrellas,
      fotoKey: datos.fotoKey ?? null,
      usadoEl: new Date(),
    },
  });
  return { ok: true as const };
}

/** Las que el admin publicó, para la portada. Las más nuevas primero. */
export async function valoracionesPublicadas(cuantas = 6) {
  const filas = await db.valoracion.findMany({
    where: { publicada: true, usadoEl: { not: null } },
    orderBy: { usadoEl: "desc" },
    take: cuantas,
    include: { grupo: { select: { nombre: true } } },
  });
  return filas.map((v) => ({
    id: v.id,
    nombre: v.nombre,
    comentario: v.comentario,
    estrellas: v.estrellas,
    grupo: v.grupo?.nombre ?? null,
    // La foto se sirve por su propia ruta, que sólo entrega las publicadas.
    fotoUrl: v.fotoKey ? `/api/valoracion/${v.id}` : null,
  }));
}
