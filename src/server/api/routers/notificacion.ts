import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { emailHabilitado } from "~/server/email";

export const notificacionRouter = createTRPCRouter({
  /** Bandeja de salida: todo lo que el sistema habría enviado por email. */
  listar: adminProcedure
    .input(
      z.object({
        grupoId: z.string().optional(),
        limite: z.number().int().min(1).max(100).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const notificaciones = await ctx.db.notificacion.findMany({
        where: input.grupoId ? { grupoId: input.grupoId } : undefined,
        orderBy: { creadoEn: "desc" },
        take: input.limite,
        include: { grupo: { select: { nombre: true } } },
      });

      return notificaciones.map((n) => ({
        id: n.id,
        tipo: n.tipo,
        destinatario: n.destinatario,
        asunto: n.asunto,
        cuerpo: n.cuerpo,
        grupo: n.grupo?.nombre ?? null,
        creadoEn: n.creadoEn,
        enviadoEl: n.enviadoEl,
        errorEnvio: n.errorEnvio,
      }));
    }),

  /** Para que el panel aclare si los mails están saliendo o sólo registrándose. */
  modoEnvio: adminProcedure.query(() => ({
    enviando: emailHabilitado,
  })),

  contar: adminProcedure.query(({ ctx }) => ctx.db.notificacion.count()),
});
