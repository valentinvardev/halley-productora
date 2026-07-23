import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { AJUSTES, contacto, type ClaveAjuste } from "~/server/ajustes";

const CLAVES = Object.keys(AJUSTES) as [ClaveAjuste, ...ClaveAjuste[]];

export const ajusteRouter = createTRPCRouter({
  /** Lo que hay guardado hoy, con los valores por defecto donde falte. */
  obtener: adminProcedure.query(() => contacto()),

  /**
   * Guarda los ajustes que vinieron. Un upsert por clave: guardar uno no pisa
   * los otros.
   */
  guardar: adminProcedure
    .input(z.record(z.enum(CLAVES), z.string().trim()))
    .mutation(async ({ ctx, input }) => {
      const entradas = Object.entries(input) as [ClaveAjuste, string][];

      await Promise.all(
        entradas.map(([clave, valor]) =>
          ctx.db.ajuste.upsert({
            where: { clave },
            update: { valor },
            create: { clave, valor },
          }),
        ),
      );

      return contacto();
    }),
});
