import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";

/**
 * Los colegios: juntan los cursos que son del mismo lugar.
 *
 * Existen para el panel y nada más. Cada curso sigue con su plan de cuotas, su
 * link de registro y su cuenta que cobra; el colegio los muestra juntos con los
 * números sumados y se despliega para ver cada uno por separado.
 *
 * Un grupo puede no tener colegio y queda suelto en la lista, como siempre. Eso
 * es lo que permite sumarlos de a poco sin que nadie tenga que ordenar todo el
 * primer día.
 */
export const colegioRouter = createTRPCRouter({
  listar: adminProcedure.query(({ ctx }) =>
    ctx.db.colegio.findMany({
      orderBy: [{ orden: "asc" }, { creadoEn: "asc" }],
      select: { id: true, nombre: true },
    }),
  ),

  crear: adminProcedure
    .input(z.object({ nombre: z.string().trim().min(2).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const ultimo = await ctx.db.colegio.findFirst({
        orderBy: { orden: "desc" },
      });
      const colegio = await ctx.db.colegio.create({
        data: { nombre: input.nombre, orden: (ultimo?.orden ?? -1) + 1 },
      });
      return { id: colegio.id };
    }),

  renombrar: adminProcedure
    .input(
      z.object({ id: z.string(), nombre: z.string().trim().min(2).max(80) }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.colegio.update({
        where: { id: input.id },
        data: { nombre: input.nombre },
      }),
    ),

  /**
   * Borra el colegio y deja sueltos a sus cursos.
   *
   * No borra ningún grupo ni toca un peso: la relación está en `SetNull`, así
   * que los cursos vuelven a la lista de arriba tal cual estaban.
   */
  eliminar: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cuantos = await ctx.db.grupo.count({
        where: { colegioId: input.id },
      });
      await ctx.db.colegio.delete({ where: { id: input.id } });
      return { sueltos: cuantos };
    }),

  /** Mete un grupo en un colegio, o lo saca con `null`. */
  asignar: adminProcedure
    .input(
      z.object({
        grupoIds: z.array(z.string()).min(1).max(200),
        colegioId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.colegioId) {
        const existe = await ctx.db.colegio.findUnique({
          where: { id: input.colegioId },
          select: { id: true },
        });
        if (!existe) throw new TRPCError({ code: "NOT_FOUND" });
      }

      const r = await ctx.db.grupo.updateMany({
        where: { id: { in: input.grupoIds } },
        data: { colegioId: input.colegioId },
      });
      return { movidos: r.count };
    }),
});
