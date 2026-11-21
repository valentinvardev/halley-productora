import { cursosParaAlta } from "~/server/alta-api";
import { verificarClave } from "~/server/clave-api";

/**
 * Los cursos en los que se puede dar de alta un alumno por la API.
 *
 * El bot no adivina el curso a partir de lo que escribe la familia: muestra
 * esta lista (o la usa para entender "Monserrat, 6to F") y confirma con la
 * familia cuál es. Así el id que viaja en el alta es siempre uno real.
 *
 * `?prueba=1` suma los cursos de prueba, marcados, para ensayar la conexión.
 *
 * Documentación: docs/api.md.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rechazo = await verificarClave(req);
  if (rechazo) {
    return Response.json(
      { error: rechazo.error, mensaje: rechazo.mensaje },
      { status: rechazo.status },
    );
  }

  const incluirPrueba = new URL(req.url).searchParams.get("prueba") === "1";
  const cursos = await cursosParaAlta({ incluirPrueba });
  return Response.json({ cursos });
}
