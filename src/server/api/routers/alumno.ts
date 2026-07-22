import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { crearAlumno, invitarFamilia, parsearAlumnos } from "~/server/alumnos";
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
    .input(z.object({ alumnoId: z.string() }))
    .mutation(async ({ input }) => invitarFamilia(input.alumnoId)),

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
          cuenta: true,
          pagos: true,
        },
      });

      const email = alumno.cuenta?.email ?? alumno.emailContacto;
      const plan = imputarPagos(alumno.grupo.cuotas, sumarPagos(alumno.pagos));
      if (!email || !plan.proxima) return { enviado: false as const };

      await notificarRecordatorio(
        { alumno, grupo: alumno.grupo, email },
        {
          numero: plan.proxima.numero,
          monto: plan.proxima.saldo,
          venceEl: plan.proxima.venceEl,
          vencida: plan.proxima.estado === "VENCIDA",
        },
      );
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
          cuenta: true,
          pagos: true,
        },
      });

      let enviados = 0;
      for (const alumno of alumnos) {
        const email = alumno.cuenta?.email ?? alumno.emailContacto;
        const plan = imputarPagos(alumno.grupo.cuotas, sumarPagos(alumno.pagos));
        if (!email || !plan.proxima) continue;

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
      return { enviados };
    }),

  /** Suelta al alumno de la cuenta que lo reclamó (reclamo equivocado). */
  desvincular: adminProcedure
    .input(z.object({ alumnoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.alumno.update({
        where: { id: input.alumnoId },
        data: { cuentaId: null },
      });
      return { ok: true };
    }),

  eliminar: adminProcedure
    .input(z.object({ alumnoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.alumno.delete({ where: { id: input.alumnoId } });
      return { ok: true };
    }),
});
