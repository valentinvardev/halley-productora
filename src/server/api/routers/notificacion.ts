import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { enviarEmail } from "~/server/email";
import { emailHabilitado } from "~/server/email";
import { muestraEmail } from "~/server/email-muestras";
import { TIPOS_MUESTRA } from "~/server/email-muestras";

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

  /**
   * Manda una muestra de una plantilla a un email, para ver cómo llega.
   *
   * Va por Resend directo, sin pasar por la bandeja ni depender de
   * `EMAIL_MODE`: es una prueba, no una notificación real, así que no se guarda
   * como historial. Necesita `RESEND_API_KEY` puesta.
   */
  enviarPrueba: adminProcedure
    .input(
      z.object({
        tipo: z.enum(TIPOS_MUESTRA.map((t) => t.valor) as [string, ...string[]]),
        email: z.string().email(),
      }),
    )
    .mutation(async ({ input }) => {
      const muestra = muestraEmail(input.tipo as (typeof TIPOS_MUESTRA)[number]["valor"]);
      const r = await enviarEmail({
        para: input.email,
        asunto: muestra.asunto,
        texto: muestra.texto,
        html: muestra.html,
      });
      if (!r.ok) throw new TRPCError({ code: "BAD_REQUEST", message: r.error });
      return { ok: true };
    }),
});
