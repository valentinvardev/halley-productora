import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { imputarPagos, sumarPagos } from "~/server/dominio";
import { mpEsMock } from "~/server/mercadopago";
import { proveedorDeGrupo } from "~/server/pagos";
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
              galerias: {
                orderBy: { creadoEn: "desc" },
                include: { fotos: { orderBy: [{ orden: "asc" }, { creadoEn: "asc" }] } },
              },
            },
          },
          pagos: { orderBy: { recibidoEn: "desc" } },
          _count: { select: { tutores: true } },
        },
      });
      if (!alumno) throw new TRPCError({ code: "NOT_FOUND" });

      const plan = imputarPagos(alumno.grupo.cuotas, sumarPagos(alumno.pagos));

      const { proveedor } = await proveedorDeGrupo(alumno.grupoId);

      return {
        nombre: alumno.nombre,
        alias: alumno.alias,
        cvu: alumno.cvu,
        proveedor,
        reportoTransferenciaEl: alumno.reportoTransferenciaEl,
        tieneCuenta: alumno._count.tutores > 0,
        modoDemo: proveedor === "MERCADOPAGO" ? mpEsMock : taloEsMock,
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
        // Las fotos llevan el token en la URL: es la llave con la que la ruta
        // las sirve a quien entra sin cuenta. Sólo si está al día.
        galerias: alumno.grupo.galerias.map((g) => ({
          id: g.id,
          titulo: g.titulo,
          linkDrive: g.linkDrive,
          venceEl: g.venceEl,
          vigente: !g.venceEl || g.venceEl.getTime() > Date.now(),
          fotos:
            plan.deuda <= 0
              ? g.fotos.map((f) => ({
                  id: f.id,
                  nombre: f.nombre,
                  tipo: f.tipo === "video" ? ("video" as const) : ("imagen" as const),
                  url: `/api/galeria/${f.id}?t=${input.token}`,
                  descarga: `/api/galeria/${f.id}?descargar=1&t=${input.token}`,
                }))
              : [],
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
