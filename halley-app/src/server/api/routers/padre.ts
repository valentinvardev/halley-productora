import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { estadoVisible, linkPadre, montoDe } from "~/server/dominio";
import { notificarRecordatorio } from "~/server/notificaciones";
import { crearPadre, invitarPadre, parsearPadres } from "~/server/padres";
import { taloEsMock } from "~/server/talo";

export const padreRouter = createTRPCRouter({
  /* ------------------------------------------------------------------ panel */

  agregar: adminProcedure
    .input(
      z.object({
        grupoId: z.string(),
        nombre: z.string().min(2),
        email: z.string().email(),
        telefono: z.string().optional(),
        montoCuota: z.number().positive().optional(),
        invitar: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const { padre, yaExistia } = await crearPadre({
        ...input,
        origen: "ADMIN",
      });
      if (!yaExistia && input.invitar) await invitarPadre(padre.id);
      return { id: padre.id, yaExistia };
    }),

  agregarEnBloque: adminProcedure
    .input(
      z.object({
        grupoId: z.string(),
        texto: z.string().min(1),
        invitar: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const { filas, errores } = parsearPadres(input.texto);

      let creados = 0;
      let repetidos = 0;
      for (const fila of filas) {
        const { padre, yaExistia } = await crearPadre({
          grupoId: input.grupoId,
          nombre: fila.nombre,
          email: fila.email,
          origen: "ADMIN",
        });
        if (yaExistia) {
          repetidos += 1;
          continue;
        }
        creados += 1;
        if (input.invitar) await invitarPadre(padre.id);
      }

      return { creados, repetidos, errores };
    }),

  invitar: adminProcedure
    .input(z.object({ padreId: z.string() }))
    .mutation(async ({ input }) => {
      await invitarPadre(input.padreId);
      return { ok: true };
    }),

  invitarPendientes: adminProcedure
    .input(z.object({ grupoId: z.string(), soloNoInvitados: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const padres = await ctx.db.padre.findMany({
        where: {
          grupoId: input.grupoId,
          estado: "PENDIENTE",
          ...(input.soloNoInvitados ? { invitadoEl: null } : {}),
        },
        select: { id: true },
      });

      for (const padre of padres) await invitarPadre(padre.id);
      return { enviados: padres.length };
    }),

  recordar: adminProcedure
    .input(z.object({ padreId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const padre = await ctx.db.padre.findUniqueOrThrow({
        where: { id: input.padreId },
        include: { grupo: true },
      });
      await notificarRecordatorio(
        { padre, grupo: padre.grupo },
        montoDe(padre, padre.grupo),
      );
      return { ok: true };
    }),

  /**
   * Lo que va a disparar el cron de recordatorios. Por ahora se ejecuta a mano
   * desde el panel; la frecuencia la define Halley.
   */
  recordarPendientes: adminProcedure
    .input(z.object({ grupoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const padres = await ctx.db.padre.findMany({
        where: { grupoId: input.grupoId, estado: "PENDIENTE" },
        include: { grupo: true },
      });

      for (const padre of padres) {
        await notificarRecordatorio(
          { padre, grupo: padre.grupo },
          montoDe(padre, padre.grupo),
        );
      }
      return { enviados: padres.length };
    }),

  eliminar: adminProcedure
    .input(z.object({ padreId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.padre.delete({ where: { id: input.padreId } });
      return { ok: true };
    }),

  /* ----------------------------------------------------- público, por token */

  porToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const padre = await ctx.db.padre.findUnique({
        where: { token: input.token },
        include: { grupo: true, pagos: { orderBy: { recibidoEn: "desc" } } },
      });
      if (!padre) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        nombre: padre.nombre,
        alias: padre.alias,
        cvu: padre.cvu,
        monto: montoDe(padre, padre.grupo),
        estado: estadoVisible(padre.estado, padre.grupo.venceEl),
        reportoTransferenciaEl: padre.reportoTransferenciaEl,
        grupo: {
          nombre: padre.grupo.nombre,
          colegio: padre.grupo.colegio,
          venceEl: padre.grupo.venceEl,
          cuotaActual: padre.grupo.cuotaActual,
          cuotasTotales: padre.grupo.cuotasTotales,
        },
        pagos: padre.pagos.map((p) => ({
          monto: Number(p.monto),
          recibidoEn: p.recibidoEn,
        })),
        /** Habilita el botón de simulación de la demo. */
        modoDemo: taloEsMock,
      };
    }),

  /** "Ya transferí": aviso del padre, no confirma el pago. */
  reportarTransferencia: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.padre.update({
        where: { token: input.token },
        data: { reportoTransferenciaEl: new Date() },
      });
      return { ok: true };
    }),

  /* --------------------------------------------- público, auto-registro /g/ */

  grupoPorSlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const grupo = await ctx.db.grupo.findUnique({
        where: { slug: input.slug },
      });
      if (!grupo || !grupo.autoRegistro) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        nombre: grupo.nombre,
        colegio: grupo.colegio,
        montoCuota: Number(grupo.montoCuota),
        venceEl: grupo.venceEl,
        cuotaActual: grupo.cuotaActual,
        cuotasTotales: grupo.cuotasTotales,
      };
    }),

  registrarse: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        nombre: z.string().min(2),
        email: z.string().email(),
        telefono: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const grupo = await ctx.db.grupo.findUnique({ where: { slug: input.slug } });
      if (!grupo || !grupo.autoRegistro) throw new TRPCError({ code: "NOT_FOUND" });

      const { padre, yaExistia } = await crearPadre({
        grupoId: grupo.id,
        nombre: input.nombre,
        email: input.email,
        telefono: input.telefono,
        origen: "AUTO_REGISTRO",
      });

      // El mail con el link se manda igual: el padre puede estar anotándose
      // desde otro dispositivo.
      if (!yaExistia) await invitarPadre(padre.id);

      return { link: linkPadre(padre.token), token: padre.token, yaExistia };
    }),
});
