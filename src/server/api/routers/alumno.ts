import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  crearAlumno,
  destinatarios,
  invitarFamilia,
  parsearAlumnos,
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
      }),
    )
    .mutation(async ({ input }) => {
      const { alumno, yaExistia } = await crearAlumno({
        grupoId: input.grupoId,
        nombre: input.nombre,
        emailContacto: input.emailContacto || null,
      });

      if (!yaExistia && input.invitar) await invitarFamilia(alumno.id);
      return { id: alumno.id, yaExistia };
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

  invitarTodos: adminProcedure
    .input(z.object({ grupoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const alumnos = await ctx.db.alumno.findMany({
        where: { grupoId: input.grupoId },
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
          tutores: { include: { cuenta: true } },
          pagos: true,
        },
      });

      const emails = destinatarios(alumno);
      const plan = imputarPagos(alumno.grupo.cuotas, sumarPagos(alumno.pagos));
      if (emails.length === 0 || !plan.proxima) return { enviado: false as const };

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
          tutores: { include: { cuenta: true } },
          pagos: true,
        },
      });

      let enviados = 0;
      for (const alumno of alumnos) {
        const plan = imputarPagos(alumno.grupo.cuotas, sumarPagos(alumno.pagos));
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
      return { enviados };
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
