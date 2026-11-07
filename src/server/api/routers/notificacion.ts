import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  PLANES_RESEND,
  planResend,
  type PlanResend,
} from "~/app/_datos/correo";
import { guardarCorreo, leerCorreo } from "~/server/correo-ajustes";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { enviarEmail } from "~/server/email";
import { emailHabilitado } from "~/server/email";
import { muestraEmail } from "~/server/email-muestras";
import { TIPOS_MUESTRA } from "~/server/email-muestras";
import {
  PLANTILLAS_ORDEN,
  guardarPlantilla,
  restaurarPlantilla,
  todasLasPlantillas,
  type IdPlantilla,
} from "~/server/plantillas";

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
        entregadoEl: n.entregadoEl,
        rebotadoEl: n.rebotadoEl,
        quejaEl: n.quejaEl,
        detalleEntrega: n.detalleEntrega,
        remitente: n.remitente,
      }));
    }),

  /** Para que el panel aclare si los mails están saliendo o sólo registrándose. */
  modoEnvio: adminProcedure.query(() => ({
    enviando: emailHabilitado,
  })),

  contar: adminProcedure.query(({ ctx }) => ctx.db.notificacion.count()),

  /**
   * Cuántos correos se gastaron contra el plan de Resend.
   *
   * Existe para no enterarse tarde. Cuando el cupo se llena Resend deja de
   * aceptar envíos: los pagos se siguen registrando pero las familias no
   * reciben ni el comprobante ni el aviso de que les falta plata, y eso se
   * descubre cuando alguien reclama, varios días después.
   *
   * Cuenta `enviadoEl` y no las filas de la bandeja. En modo bandeja se
   * registra todo y no sale nada, y una que Resend rechazó quedó anotada con su
   * error pero tampoco consumió cupo. Lo que gasta es lo que Resend aceptó.
   *
   * El día se corta a medianoche UTC, que en Argentina son las 21. No es un
   * descuido: es cuando Resend reinicia su tope diario. Antes se cortaba a
   * medianoche de Córdoba, y entre las 21 y las 24 el panel mostraba cupo
   * gastado que Resend ya había devuelto.
   *
   * El plan lo elige el panel. Antes eran dos números escritos a mano para el
   * plan gratuito, y desde que Halley pasó a uno pago el medidor mostraba
   * "casi sin cupo" en rojo con cuatro mil correos de margen.
   */
  uso: adminProcedure.query(async ({ ctx }) => {
    const ahora = new Date();
    const hoy = new Date(
      Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()),
    );
    const primeroDelMes = new Date(
      Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1),
    );
    const hace30 = new Date(hoy.getTime() - 30 * 86_400_000);

    const [mes, dia, picos, ajustes] = await Promise.all([
      ctx.db.notificacion.count({
        where: { enviadoEl: { gte: primeroDelMes } },
      }),
      ctx.db.notificacion.count({ where: { enviadoEl: { gte: hoy } } }),
      ctx.db.$queryRaw<{ n: number }[]>`
        select count(*)::int as n from "Notificacion"
        where "enviadoEl" >= ${hace30}
        group by date_trunc('day', "enviadoEl" at time zone 'UTC')
        order by n desc limit 1`,
      leerCorreo(),
    ]);
    const plan = planResend(ajustes.plan);

    return {
      mes,
      dia,
      plan: plan.valor,
      limiteMes: plan.mes,
      limiteDia: plan.dia,
      /**
       * El día con más envíos aceptados de los últimos 30. Si pasa de 100, la
       * cuenta no puede estar en el plan gratuito, y el panel lo dice: es la
       * forma de que un plan mal elegido no quede mintiendo en silencio.
       */
      picoDiario: picos[0]?.n ?? 0,
      /** Sin envío real no se gasta cupo, y el cartel tiene que decirlo. */
      enviando: emailHabilitado,
    };
  }),

  /** El plan de Resend contra el que se mide el cupo. */
  guardarPlan: adminProcedure
    .input(
      z.object({
        plan: z.enum(
          PLANES_RESEND.map((p) => p.valor) as [PlanResend, ...PlanResend[]],
        ),
      }),
    )
    .mutation(async ({ input }) => {
      await guardarCorreo({ plan: input.plan });
      return { ok: true };
    }),

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

  /* --------------------------------------------------- textos de los mails */

  /**
   * Los textos editables, con el vigente y el de fábrica.
   *
   * Van los dos porque el panel necesita poder mostrar "esto está editado" y
   * ofrecer volver atrás sin pedirle otra consulta al servidor.
   */
  plantillas: adminProcedure.query(() => todasLasPlantillas()),

  guardarPlantilla: adminProcedure
    .input(
      z.object({
        id: z.enum(PLANTILLAS_ORDEN as [IdPlantilla, ...IdPlantilla[]]),
        // El asunto y el título son de una línea; el cuerpo y la nota pueden
        // ser largos. Los topes están para que nadie pegue un documento entero
        // en un campo que después se manda por correo.
        asunto: z.string().trim().min(1).max(200),
        titulo: z.string().trim().min(1).max(200),
        parrafo: z.string().trim().min(1).max(2000),
        nota: z.string().trim().max(500),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...textos } = input;
      await guardarPlantilla(id, textos);
      return { ok: true };
    }),

  /** Vuelve una plantilla al texto del código. */
  restaurarPlantilla: adminProcedure
    .input(
      z.object({
        id: z.enum(PLANTILLAS_ORDEN as [IdPlantilla, ...IdPlantilla[]]),
      }),
    )
    .mutation(async ({ input }) => {
      await restaurarPlantilla(input.id);
      return { ok: true };
    }),
});
