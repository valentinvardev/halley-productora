import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { AJUSTES, contacto, type ClaveAjuste } from "~/server/ajustes";
import {
  BLOQUES_ORDEN,
  guardarBloque,
  restaurarBloque,
  todosLosBloques,
  type IdBloque,
} from "~/server/textos-sitio";

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

  /* ------------------------------------------------- textos de la web */

  /** Los bloques de texto editables, con lo vigente y lo de fábrica. */
  textos: adminProcedure.query(() => todosLosBloques()),

  guardarTexto: adminProcedure
    .input(
      z.object({
        id: z.enum(BLOQUES_ORDEN as [IdBloque, ...IdBloque[]]),
        // Cada bloque tiene sus propios campos, así que el detalle se valida
        // adentro: `guardarBloque` descarta lo que no esté en el catálogo. Acá
        // sólo se corta el largo, para que nadie pegue un documento entero en
        // un titular.
        textos: z.record(z.string().max(60), z.string().trim().max(2000)),
      }),
    )
    .mutation(async ({ input }) => {
      await guardarBloque(input.id, input.textos);
      return { ok: true };
    }),

  restaurarTexto: adminProcedure
    .input(z.object({ id: z.enum(BLOQUES_ORDEN as [IdBloque, ...IdBloque[]]) }))
    .mutation(async ({ input }) => {
      await restaurarBloque(input.id);
      return { ok: true };
    }),
});
