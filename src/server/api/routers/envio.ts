import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { destinatarios, invitarFamilia } from "~/server/alumnos";
import { imputarPagos, sumarPagos } from "~/server/dominio";
import { notificarRecordatorio } from "~/server/notificaciones";

/**
 * Envíos en masa, por colegio.
 *
 * Es lo mismo que invitar o recordar de a un grupo, pero pudiendo abarcar
 * varios colegios de una. La diferencia que importa no es el alcance sino el
 * ritmo: el 24 y el 25 de septiembre de 2026 una carga grande mandó doscientos
 * mails de golpe, se agotó la cuota diaria del proveedor y 251 avisos nunca
 * salieron, para 170 familias. Nadie se enteró hasta que alguien fue a mirar.
 *
 * Por eso acá el envío no es una llamada que manda todo: primero se pregunta a
 * quiénes les tocaría, y después se manda de a tandas chicas, con la pantalla
 * mostrando el avance. Así el que aprieta ve cuánto va a salir antes de que
 * salga, y si algo se rompe se rompe en una tanda y no en todo.
 */

const tipoEnvio = z.enum(["invitacion", "recordatorio"]);

/** Cuántos destinatarios entran en una tanda. */
export const TANDA = 25;

const conTodo = {
  grupo: { include: { cuotas: true } },
  ajustesCuota: true,
  tutores: { include: { cuenta: true } },
  pagos: true,
} as const;

export const envioRouter = createTRPCRouter({
  /**
   * A quiénes les tocaría, y por qué los demás quedan afuera.
   *
   * Devuelve la lista de alumnos y el detalle de los descartes, porque "se le
   * va a escribir a 40 de 103" sin decir qué pasó con los otros 63 es un número
   * que no se puede auditar.
   */
  destinatarios: adminProcedure
    .input(
      z.object({
        /** Colegios elegidos. `null` adentro de la lista son los grupos sueltos. */
        colegioIds: z.array(z.string().nullable()).max(100),
        tipo: tipoEnvio,
        /** En invitaciones: saltear a las familias ya invitadas. */
        soloPendientes: z.boolean().default(true),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.colegioIds.length === 0) {
        return { alumnoIds: [], total: 0, descartes: {}, grupos: 0 };
      }

      const conColegio = input.colegioIds.filter(
        (x): x is string => x !== null,
      );
      const incluirSueltos = input.colegioIds.includes(null);

      const alumnos = await ctx.db.alumno.findMany({
        where: {
          grupo: {
            OR: [
              ...(conColegio.length ? [{ colegioId: { in: conColegio } }] : []),
              ...(incluirSueltos ? [{ colegioId: null }] : []),
            ],
          },
        },
        include: conTodo,
      });

      const descartes: Record<string, number> = {};
      const descartar = (motivo: string) => {
        descartes[motivo] = (descartes[motivo] ?? 0) + 1;
      };

      const elegidos: string[] = [];
      const grupos = new Set<string>();

      for (const alumno of alumnos) {
        grupos.add(alumno.grupoId);

        if (destinatarios(alumno).length === 0) {
          descartar("sin email");
          continue;
        }

        if (input.tipo === "invitacion") {
          if (input.soloPendientes && alumno.invitadaEl) {
            descartar("ya invitadas");
            continue;
          }
        } else {
          // El recordatorio no puede ser el primer mail que una familia recibe:
          // le hablaría de una deuda sin haberle explicado nunca de qué se trata.
          if (!alumno.invitadaEl) {
            descartar("todavía sin invitar");
            continue;
          }
          const plan = imputarPagos(
            alumno.grupo.cuotas,
            alumno.ajustesCuota,
            sumarPagos(alumno.pagos),
          );
          if (!plan.proxima) {
            descartar("al día");
            continue;
          }
        }

        elegidos.push(alumno.id);
      }

      return {
        alumnoIds: elegidos,
        total: elegidos.length,
        descartes,
        grupos: grupos.size,
      };
    }),

  /**
   * Manda una tanda.
   *
   * Recibe los alumnos de a pocos y no el alcance entero a propósito: así la
   * pantalla puede mostrar el avance, cortar si algo falla y espaciar los
   * envíos. Una sola llamada con cuatrocientos destinatarios se pasaría del
   * tiempo de respuesta y dejaría a medias sin que nadie sepa dónde.
   */
  tanda: adminProcedure
    .input(
      z.object({
        alumnoIds: z.array(z.string()).min(1).max(TANDA),
        tipo: tipoEnvio,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let enviados = 0;
      const fallados: { alumno: string; motivo: string }[] = [];

      for (const id of input.alumnoIds) {
        const alumno = await ctx.db.alumno.findUnique({
          where: { id },
          include: conTodo,
        });
        if (!alumno) continue;

        try {
          if (input.tipo === "invitacion") {
            const r = await invitarFamilia(alumno.id);
            if (r.enviado) enviados += 1;
            else fallados.push({ alumno: alumno.nombre, motivo: "sin email" });
            continue;
          }

          const plan = imputarPagos(
            alumno.grupo.cuotas,
            alumno.ajustesCuota,
            sumarPagos(alumno.pagos),
          );
          if (!plan.proxima || !alumno.invitadaEl) continue;

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
          }
          enviados += 1;
        } catch (e) {
          fallados.push({
            alumno: alumno.nombre,
            motivo: e instanceof Error ? e.message : "error desconocido",
          });
        }
      }

      return { enviados, fallados };
    }),
});
