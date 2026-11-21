import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { ALTAS_POR_HORA } from "~/server/alta-api";
import { estadoClave, generarClave, revocarClave } from "~/server/clave-api";

/**
 * La clave de la API para bots, desde Ajustes.
 *
 * `generar` es la única vez que la clave viaja al navegador. Después el panel
 * sólo ve cómo termina y cuándo se usó.
 */
export const apiExternaRouter = createTRPCRouter({
  estado: adminProcedure.query(async () => ({
    clave: await estadoClave(),
    altasPorHora: ALTAS_POR_HORA,
  })),

  generar: adminProcedure.mutation(async () => ({
    clave: await generarClave(),
  })),

  revocar: adminProcedure.mutation(async () => {
    await revocarClave();
    return { ok: true };
  }),
});
