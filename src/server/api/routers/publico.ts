import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { imputarPagos, sumarPagos } from "~/server/dominio";
import { taloEsMock } from "~/server/talo";

/**
 * El link personal sin login (/p/[token]).
 *
 * Sigue existiendo aunque ahora haya cuentas: es el link que ya salió por mail
 * y el camino para la familia que no se quiere registrar. La autorización acá
 * es el token, así que no se devuelve nada que no sea de ese alumno.
 */
export const publicoRouter = createTRPCRouter({
  porToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const alumno = await ctx.db.alumno.findUnique({
        where: { token: input.token },
        include: {
          grupo: {
            include: {
              cuotas: { orderBy: { numero: "asc" } },
              galerias: { orderBy: { creadoEn: "desc" } },
            },
          },
          pagos: { orderBy: { recibidoEn: "desc" } },
        },
      });
      if (!alumno) throw new TRPCError({ code: "NOT_FOUND" });

      const plan = imputarPagos(alumno.grupo.cuotas, sumarPagos(alumno.pagos));

      return {
        nombre: alumno.nombre,
        alias: alumno.alias,
        cvu: alumno.cvu,
        reportoTransferenciaEl: alumno.reportoTransferenciaEl,
        tieneCuenta: alumno.cuentaId !== null,
        modoDemo: taloEsMock,
        grupo: {
          nombre: alumno.grupo.nombre,
          colegio: alumno.grupo.colegio,
          slug: alumno.grupo.slug,
        },
        plan: {
          total: plan.total,
          pagado: plan.pagado,
          deuda: plan.deuda,
          aFavor: plan.aFavor,
          alDia: plan.alDia,
          cuotas: plan.cuotas,
          proxima: plan.proxima,
        },
        pagos: alumno.pagos.map((p) => ({
          monto: Number(p.monto),
          recibidoEn: p.recibidoEn,
        })),
        galerias: alumno.grupo.galerias.map((g) => ({
          id: g.id,
          titulo: g.titulo,
          linkDrive: g.linkDrive,
          venceEl: g.venceEl,
          vigente: !g.venceEl || g.venceEl.getTime() > Date.now(),
        })),
      };
    }),

  /** "Ya transferí": aviso de la familia, no confirma el pago. */
  reportarTransferencia: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.alumno.update({
        where: { token: input.token },
        data: { reportoTransferenciaEl: new Date() },
      });
      return { ok: true };
    }),
});
