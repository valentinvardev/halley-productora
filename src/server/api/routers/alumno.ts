import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  crearAlumno,
  destinatarios,
  invitarFamilia,
  parsearAlumnos,
  perdonarMora,
} from "~/server/alumnos";
import { imputarPagos, sumarPagos } from "~/server/dominio";
import { notificarRecordatorio } from "~/server/notificaciones";

export const alumnoRouter = createTRPCRouter({
  agregar: adminProcedure
    .input(
      z.object({
        grupoId: z.string(),
        nombre: z.string().min(2),
        emailContacto: z.string().email().optional().or(z.literal("")),
        invitar: z.boolean().default(true),
        /** A qué cuotas no cobrarle mora, por número. Para el que entra tarde. */
        sinMoraCuotas: z.array(z.number().int().positive()).max(60).default([]),
      }),
    )
    .mutation(async ({ input }) => {
      const { alumno, yaExistia } = await crearAlumno({
        grupoId: input.grupoId,
        nombre: input.nombre,
        emailContacto: input.emailContacto || null,
      });

      if (!yaExistia) {
        await perdonarMora(alumno.id, input.grupoId, input.sinMoraCuotas);
      }
      if (!yaExistia && input.invitar) await invitarFamilia(alumno.id);
      return { id: alumno.id, yaExistia };
    }),

  agregarEnBloque: adminProcedure
    .input(
      z.object({
        grupoId: z.string(),
        texto: z.string().min(1),
        invitar: z.boolean().default(true),
        /** A qué cuotas no cobrarles mora, por número. Para los que entran tarde. */
        sinMoraCuotas: z.array(z.number().int().positive()).max(60).default([]),
      }),
    )
    .mutation(async ({ input }) => {
      const { filas, errores } = parsearAlumnos(input.texto);

      let creados = 0;
      let repetidos = 0;
      for (const fila of filas) {
        const { alumno, yaExistia } = await crearAlumno({
          grupoId: input.grupoId,
          nombre: fila.nombre,
          emailContacto: fila.emailContacto ?? null,
        });

        if (yaExistia) {
          repetidos += 1;
          continue;
        }
        creados += 1;
        await perdonarMora(alumno.id, input.grupoId, input.sinMoraCuotas);
        if (input.invitar) await invitarFamilia(alumno.id);
      }

      return { creados, repetidos, errores };
    }),

  invitar: adminProcedure
    .input(
      z.object({
        alumnoId: z.string(),
        /** Si viene, se manda ahí y queda como contacto del alumno. */
        email: z.string().email().optional().or(z.literal("")),
      }),
    )
    .mutation(async ({ input }) =>
      invitarFamilia(input.alumnoId, { email: input.email || undefined }),
    ),

  /**
   * Invita al grupo entero, o sólo a los que todavía no recibieron nada.
   *
   * Lo segundo es lo que hace falta cuando se cargan alumnos sin invitar y
   * después se los quiere sumar: invitar a todos de nuevo le escribiría otra
   * vez a las familias que ya se registraron.
   */
  invitarTodos: adminProcedure
    .input(
      z.object({
        grupoId: z.string(),
        soloPendientes: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const alumnos = await ctx.db.alumno.findMany({
        where: {
          grupoId: input.grupoId,
          ...(input.soloPendientes ? { invitadaEl: null } : {}),
        },
        select: { id: true },
      });

      let enviados = 0;
      for (const alumno of alumnos) {
        const r = await invitarFamilia(alumno.id);
        if (r.enviado) enviados += 1;
      }
      return { enviados, sinEmail: alumnos.length - enviados };
    }),

  /** Recordatorio de la cuota impaga más vieja. */
  recordar: adminProcedure
    .input(z.object({ alumnoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const alumno = await ctx.db.alumno.findUniqueOrThrow({
        where: { id: input.alumnoId },
        include: {
          grupo: { include: { cuotas: true } },
          ajustesCuota: true,
          tutores: { include: { cuenta: true } },
          pagos: true,
        },
      });

      const emails = destinatarios(alumno);
      const plan = imputarPagos(
        alumno.grupo.cuotas,
        alumno.ajustesCuota,
        sumarPagos(alumno.pagos),
      );
      if (emails.length === 0 || !plan.proxima)
        return { enviado: false as const };

      // A una familia que todavía no fue invitada no se le arranca por un
      // recordatorio de cuota: sería el primer mail que recibe de Halley, y
      // diría que debe plata sin haberle explicado nunca de qué se trata.
      if (!alumno.invitadaEl)
        return { enviado: false as const, motivo: "sin-invitar" as const };

      // El recordatorio va a todos los responsables del alumno.
      for (const email of emails) {
        await notificarRecordatorio(
          { alumno, grupo: alumno.grupo, email },
          {
            numero: plan.proxima.numero,
            monto: plan.proxima.saldo,
            venceEl: plan.proxima.venceEl,
            vencida: plan.proxima.estado === "VENCIDA",
          },
        );
      }
      return { enviado: true as const };
    }),

  /** Lo que va a disparar el cron: recordatorio a todo el que deba algo. */
  recordarPendientes: adminProcedure
    .input(z.object({ grupoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const alumnos = await ctx.db.alumno.findMany({
        where: { grupoId: input.grupoId },
        include: {
          grupo: { include: { cuotas: true } },
          ajustesCuota: true,
          tutores: { include: { cuenta: true } },
          pagos: true,
        },
      });

      let enviados = 0;
      let sinInvitar = 0;
      for (const alumno of alumnos) {
        // Mismo criterio que el recordatorio de a uno: primero la invitación.
        if (!alumno.invitadaEl) {
          sinInvitar += 1;
          continue;
        }
        const plan = imputarPagos(
          alumno.grupo.cuotas,
          alumno.ajustesCuota,
          sumarPagos(alumno.pagos),
        );
        if (!plan.proxima) continue;

        // A todos los responsables del alumno, no a uno solo.
        for (const email of destinatarios(alumno)) {
          await notificarRecordatorio(
            { alumno, grupo: alumno.grupo, email },
            {
              numero: plan.proxima.numero,
              monto: plan.proxima.saldo,
              venceEl: plan.proxima.venceEl,
              vencida: plan.proxima.estado === "VENCIDA",
            },
          );
          enviados += 1;
        }
      }
      return { enviados, sinInvitar };
    }),

  /** Saca a un responsable de un alumno (registro equivocado). */
  desvincular: adminProcedure
    .input(z.object({ tutorId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.tutor.delete({ where: { id: input.tutorId } });
      return { ok: true };
    }),

  eliminar: adminProcedure
    .input(z.object({ alumnoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.alumno.delete({ where: { id: input.alumnoId } });
      return { ok: true };
    }),
});
