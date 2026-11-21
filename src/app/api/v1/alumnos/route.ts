import { z } from "zod";

import { altaDesdeApi } from "~/server/alta-api";
import { verificarClave } from "~/server/clave-api";

/**
 * Alta de un alumno desde afuera: lo mismo que "Agregar alumno" en el panel,
 * invitación por correo incluida.
 *
 * El bot confirma el registro a la familia sólo con un 201 (`creado`) o un 200
 * (`ya_estaba`). Cualquier otra respuesta es que no se hizo nada, y `mensaje`
 * dice por qué. Mandar dos veces lo mismo no duplica: la segunda contesta
 * `ya_estaba`.
 *
 * Documentación: docs/api.md.
 */

export const dynamic = "force-dynamic";

const Alta = z.object({
  cursoId: z.string().trim().min(1).max(64),
  nombre: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  forzar: z.boolean().optional(),
  confirmarEmail: z.boolean().optional(),
});

export async function POST(req: Request) {
  const rechazo = await verificarClave(req);
  if (rechazo) {
    return Response.json(
      { error: rechazo.error, mensaje: rechazo.mensaje },
      { status: rechazo.status },
    );
  }

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return Response.json(
      { error: "json_invalido", mensaje: "El cuerpo tiene que ser JSON." },
      { status: 400 },
    );
  }

  const datos = Alta.safeParse(cuerpo);
  if (!datos.success) {
    const campos = datos.error.issues.map((i) => i.path.join(".") || "cuerpo");
    return Response.json(
      {
        error: "datos_invalidos",
        mensaje: `Faltan datos o vinieron mal: ${[...new Set(campos)].join(", ")}.`,
        campos: [...new Set(campos)],
      },
      { status: 400 },
    );
  }

  try {
    const r = await altaDesdeApi(datos.data);
    return Response.json(r.cuerpo, { status: r.status });
  } catch (e) {
    console.error("[api] alta:", e);
    return Response.json(
      {
        error: "error_interno",
        mensaje: "Algo falló de este lado y no se sabe si el alta quedó hecha. Se puede reintentar con los mismos datos: no duplica.",
      },
      { status: 500 },
    );
  }
}
