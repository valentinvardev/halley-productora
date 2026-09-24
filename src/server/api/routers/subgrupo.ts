import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";

/**
 * Las carpetas de alumnos dentro de un grupo.
 *
 * Son sólo organización. No cobran distinto, no tienen plan propio y no cambian
 * ninguna cuenta: el plan vive en el grupo y ahí se queda. Existen porque un
 * grupo de sesenta alumnos en una lista plana no se maneja.
 *
 * Un alumno está en una carpeta o en ninguna. Los que están en ninguna quedan
 * arriba de todo, sin asignar, y eso es un estado válido y no un pendiente: un
 * grupo puede no usar carpetas nunca y funciona igual que siempre.
 */
export const subgrupoRouter = createTRPCRouter({
  crear: adminProcedure
    .input(
      z.object({
        grupoId: z.string(),
        nombre: z.string().trim().min(1).max(60),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ultima = await ctx.db.subgrupo.findFirst({
        where: { grupoId: input.grupoId },
        orderBy: { orden: "desc" },
      });

      const carpeta = await ctx.db.subgrupo.create({
        data: {
          grupoId: input.grupoId,
          nombre: input.nombre,
          orden: (ultima?.orden ?? -1) + 1,
        },
      });
      return { id: carpeta.id };
    }),

  renombrar: adminProcedure
    .input(
      z.object({ id: z.string(), nombre: z.string().trim().min(1).max(60) }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.subgrupo.update({
        where: { id: input.id },
        data: { nombre: input.nombre },
      }),
    ),

  /**
   * Borra la carpeta y devuelve a sus alumnos a "sin asignar".
   *
   * No borra a nadie: la relación está en `SetNull`, así que los alumnos suben
   * solos. Vale la pena decirlo en la pantalla, porque borrar un grupo sí borra
   * a sus alumnos y la cercanía se presta a confusión.
   */
  eliminar: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cuantos = await ctx.db.alumno.count({
        where: { subgrupoId: input.id },
      });
      await ctx.db.subgrupo.delete({ where: { id: input.id } });
      return { sueltos: cuantos };
    }),

  /**
   * Mueve alumnos a una carpeta, o los saca de todas con `null`.
   *
   * Recibe la lista de alumnos y el destino, y no "a este alumno le toca esta
   * carpeta" de a uno: arrastrar mueve uno, pero el mismo camino sirve para
   * mandar veinte de una desde la carga en bloque.
   */
  asignar: adminProcedure
    .input(
      z.object({
        alumnoIds: z.array(z.string()).min(1).max(500),
        subgrupoId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // La carpeta tiene que ser del mismo grupo que los alumnos. Sin esto, un
      // id equivocado movería gente al grupo de otro colegio sin avisar.
      if (input.subgrupoId) {
        const carpeta = await ctx.db.subgrupo.findUnique({
          where: { id: input.subgrupoId },
          select: { grupoId: true },
        });
        if (!carpeta) throw new TRPCError({ code: "NOT_FOUND" });

        const ajenos = await ctx.db.alumno.count({
          where: {
            id: { in: input.alumnoIds },
            grupoId: { not: carpeta.grupoId },
          },
        });
        if (ajenos > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Esa carpeta es de otro grupo.",
          });
        }
      }

      const r = await ctx.db.alumno.updateMany({
        where: { id: { in: input.alumnoIds } },
        data: { subgrupoId: input.subgrupoId },
      });
      return { movidos: r.count };
    }),

  /** Sube o baja una carpeta un lugar entre sus hermanas. */
  mover: adminProcedure
    .input(z.object({ id: z.string(), direccion: z.enum(["sube", "baja"]) }))
    .mutation(async ({ ctx, input }) => {
      const carpeta = await ctx.db.subgrupo.findUnique({
        where: { id: input.id },
      });
      if (!carpeta) throw new TRPCError({ code: "NOT_FOUND" });

      const lista = await ctx.db.subgrupo.findMany({
        where: { grupoId: carpeta.grupoId },
        orderBy: [{ orden: "asc" }, { creadoEn: "asc" }],
        select: { id: true },
      });

      const desde = lista.findIndex((c) => c.id === carpeta.id);
      const hasta = input.direccion === "sube" ? desde - 1 : desde + 1;
      if (desde < 0 || hasta < 0 || hasta >= lista.length) return { ok: true };

      // La lista entera renumerada, igual que el arrastre de la vitrina:
      // describir el resultado y no el movimiento es lo que evita que dos
      // clics seguidos se pisen.
      const ids = lista.map((c) => c.id);
      [ids[desde], ids[hasta]] = [ids[hasta]!, ids[desde]!];

      await ctx.db.$transaction(
        ids.map((id, i) =>
          ctx.db.subgrupo.update({ where: { id }, data: { orden: i } }),
        ),
      );
      return { ok: true };
    }),
});
