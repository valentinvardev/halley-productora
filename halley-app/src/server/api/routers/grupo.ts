import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { estadoVisible, linkGrupo, linkPadre, montoDe } from "~/server/dominio";
import { taloEsMock } from "~/server/talo";
import { slugify } from "~/lib/slug";

type PadreConPagos = {
  estado: "PENDIENTE" | "PAGADO" | "VENCIDO";
  montoCuota: unknown;
  pagos: { monto: unknown }[];
};

function resumir(
  grupo: { montoCuota: unknown; venceEl: Date },
  padres: PadreConPagos[],
) {
  const esperado = padres.reduce((t, p) => t + montoDe(p, grupo), 0);
  const recaudado = padres.reduce(
    (t, p) => t + p.pagos.reduce((s, pago) => s + Number(pago.monto), 0),
    0,
  );

  const estados = padres.map((p) => estadoVisible(p.estado, grupo.venceEl));

  return {
    padres: padres.length,
    pagados: estados.filter((e) => e === "PAGADO").length,
    pendientes: estados.filter((e) => e === "PENDIENTE").length,
    vencidos: estados.filter((e) => e === "VENCIDO").length,
    esperado,
    recaudado,
  };
}

export const grupoRouter = createTRPCRouter({
  listar: adminProcedure.query(async ({ ctx }) => {
    const grupos = await ctx.db.grupo.findMany({
      orderBy: { creadoEn: "desc" },
      include: {
        padres: {
          select: { estado: true, montoCuota: true, pagos: { select: { monto: true } } },
        },
      },
    });

    return grupos.map((g) => ({
      id: g.id,
      nombre: g.nombre,
      slug: g.slug,
      colegio: g.colegio,
      montoCuota: Number(g.montoCuota),
      cuotaActual: g.cuotaActual,
      cuotasTotales: g.cuotasTotales,
      venceEl: g.venceEl,
      autoRegistro: g.autoRegistro,
      creadoEn: g.creadoEn,
      resumen: resumir(g, g.padres),
    }));
  }),

  detalle: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const grupo = await ctx.db.grupo.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          padres: {
            orderBy: { creadoEn: "asc" },
            include: { pagos: { orderBy: { recibidoEn: "desc" } } },
          },
        },
      });

      return {
        id: grupo.id,
        nombre: grupo.nombre,
        slug: grupo.slug,
        colegio: grupo.colegio,
        montoCuota: Number(grupo.montoCuota),
        cuotaActual: grupo.cuotaActual,
        cuotasTotales: grupo.cuotasTotales,
        venceEl: grupo.venceEl,
        autoRegistro: grupo.autoRegistro,
        linkRegistro: linkGrupo(grupo.slug),
        /** Con Talo en mock el panel muestra el botón de simular transferencia. */
        modoDemo: taloEsMock,
        resumen: resumir(grupo, grupo.padres),
        padres: grupo.padres.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          email: p.email,
          telefono: p.telefono,
          alias: p.alias,
          cvu: p.cvu,
          monto: montoDe(p, grupo),
          tieneMontoPropio: p.montoCuota !== null,
          estado: estadoVisible(p.estado, grupo.venceEl),
          origen: p.origen,
          invitadoEl: p.invitadoEl,
          reportoTransferenciaEl: p.reportoTransferenciaEl,
          link: linkPadre(p.token),
          pagos: p.pagos.map((pago) => ({
            id: pago.id,
            monto: Number(pago.monto),
            recibidoEn: pago.recibidoEn,
            taloTransactionId: pago.taloTransactionId,
          })),
        })),
      };
    }),

  crear: adminProcedure
    .input(
      z.object({
        nombre: z.string().min(3),
        colegio: z.string().min(2),
        montoCuota: z.number().positive(),
        cuotaActual: z.number().int().min(1).default(1),
        cuotasTotales: z.number().int().min(1).default(1),
        venceEl: z.date(),
        autoRegistro: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // El slug va en el link público de auto-registro: tiene que ser único.
      const base = slugify(input.nombre) || "grupo";
      let slug = base;
      let intento = 1;
      while (await ctx.db.grupo.findUnique({ where: { slug } })) {
        intento += 1;
        slug = `${base}-${intento}`;
      }

      const grupo = await ctx.db.grupo.create({ data: { ...input, slug } });
      return { id: grupo.id, slug: grupo.slug };
    }),

  actualizar: adminProcedure
    .input(
      z.object({
        id: z.string(),
        montoCuota: z.number().positive().optional(),
        venceEl: z.date().optional(),
        cuotaActual: z.number().int().min(1).optional(),
        cuotasTotales: z.number().int().min(1).optional(),
        autoRegistro: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...datos } = input;
      await ctx.db.grupo.update({ where: { id }, data: datos });
      return { ok: true };
    }),

  eliminar: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.grupo.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
