import { z } from "zod";

import {
  habilitarSinEnlace,
  listarSinEnlace,
  quitarSinEnlace,
} from "~/server/acceso-sin-enlace";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";

/**
 * Entrar sin link: la excepción por cuenta que decide el administrador.
 *
 * Existe por una familia que no logra abrir el link del correo. Es, a
 * propósito, una puerta abierta: quien sepa el email entra al panel de esa
 * familia. Por eso se habilita sólo desde un alumno (nunca un email suelto),
 * se ve en la tabla del curso y en Ajustes, cuenta cada entrada y se quita
 * de a una. No es una herramienta de demo: no mira demoAbierta() ni
 * AUTH_PADRES. Las reglas viven en ~/server/acceso-sin-enlace.ts.
 *
 * Es una tabla propia y no una marca en Cuenta ni una fila JSON en Ajuste: la
 * marca no tendría dónde guardar usos, fecha y origen sin cargar a todas las
 * cuentas con columnas que no usan, y no se lista como conjunto; la fila JSON
 * sería un String para una lista de seguridad, sin índice por email, parseada
 * en cada login y con dos guardados que se pisan.
 *
 * No hay procedimiento público ni de familia: la excepción la lee sólo el
 * servidor en el login. Ninguna respuesta devuelve tokens, links ni IPs.
 */
export const accesoSinEnlaceRouter = createTRPCRouter({
  /**
   * Habilita un email para un alumno. Crea la cuenta y el vínculo si faltan.
   * La única negativa es el cupo de responsables, que es regla del dominio.
   */
  habilitar: adminProcedure
    .input(
      z.object({ alumnoId: z.string(), email: z.string().trim().email() }),
    )
    .mutation(({ input }) => habilitarSinEnlace(input.alumnoId, input.email)),

  /** Quita la excepción y cierra las sesiones que entraron por ella. */
  quitar: adminProcedure
    .input(z.object({ email: z.string().trim().email() }))
    .mutation(({ input }) => quitarSinEnlace(input.email)),

  /** Todas las puertas abiertas, con su familia. Para el bloque de Ajustes. */
  listar: adminProcedure.query(() => listarSinEnlace()),
});
