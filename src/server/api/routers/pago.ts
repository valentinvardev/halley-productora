import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "~/env";
import {
  adminProcedure,
  createTRPCRouter,
  cuentaProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import { imputarPagos, sumarPagos } from "~/server/dominio";
import { registrarTransferenciaSimulada, taloEsMock } from "~/server/talo";

/**
 * Simulador de transferencias — sólo con TALO_MODE=mock.
 *
 * Registra la transferencia como si la familia hubiese transferido desde su
 * banco y después le pega al webhook real (`POST /api/webhooks/talo`) con el
 * mismo payload que manda Talo. El resto del sistema no se entera de que fue
 * simulado: el pago entra por el mismo camino que va a usar en producción.
 */
async function simularTransferencia(alumnoId: string, montoManual?: number) {
  if (!taloEsMock) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "El simulador sólo está disponible con TALO_MODE=mock.",
    });
  }

  const alumno = await db.alumno.findUniqueOrThrow({
    where: { id: alumnoId },
    include: { grupo: { include: { cuotas: true } }, pagos: true },
  });

  const plan = imputarPagos(alumno.grupo.cuotas, sumarPagos(alumno.pagos));
  const monto = montoManual ?? plan.proxima?.saldo;

  if (!monto) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Este alumno no tiene cuotas pendientes.",
    });
  }

  const tx = await registrarTransferenciaSimulada(alumno.taloCustomerId, monto);

  const res = await fetch(`${env.NEXT_PUBLIC_APP_URL}/api/webhooks/talo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Pago recibido",
      transactionId: tx.transactionId,
      customerId: tx.customerId,
    }),
  });

  if (!res.ok) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `El webhook respondió ${res.status}`,
    });
  }

  return { transactionId: tx.transactionId, monto };
}

export const pagoRouter = createTRPCRouter({
  /** Desde el panel: el admin fuerza el pago de un alumno. */
  simular: adminProcedure
    .input(
      z.object({
        alumnoId: z.string(),
        /** Permite demostrar un pago parcial. */
        monto: z.number().positive().optional(),
      }),
    )
    .mutation(({ input }) => simularTransferencia(input.alumnoId, input.monto)),

  /** Desde el link sin login, con el token del alumno. */
  simularDesdeToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const alumno = await ctx.db.alumno.findUnique({
        where: { token: input.token },
        select: { id: true },
      });
      if (!alumno) throw new TRPCError({ code: "NOT_FOUND" });

      return simularTransferencia(alumno.id);
    }),

  /** Desde el dashboard del padre, para uno de sus hijos. */
  simularDesdeCuenta: cuentaProcedure
    .input(z.object({ alumnoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Sólo se puede pagar por un alumno del que se es responsable.
      const vinculo = await ctx.db.tutor.findUnique({
        where: {
          cuentaId_alumnoId: {
            cuentaId: ctx.cuenta.id,
            alumnoId: input.alumnoId,
          },
        },
      });
      if (!vinculo) throw new TRPCError({ code: "NOT_FOUND" });

      const alumno = { id: input.alumnoId };

      return simularTransferencia(alumno.id);
    }),

  recientes: adminProcedure
    .input(z.object({ limite: z.number().int().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      const pagos = await ctx.db.pago.findMany({
        orderBy: { recibidoEn: "desc" },
        take: input.limite,
        include: { alumno: { include: { grupo: true } }, cuota: true },
      });

      return pagos.map((p) => ({
        id: p.id,
        monto: Number(p.monto),
        recibidoEn: p.recibidoEn,
        cuota: p.cuota?.numero ?? null,
        alumno: p.alumno.nombre,
        grupo: p.alumno.grupo.nombre,
        grupoId: p.alumno.grupoId,
      }));
    }),
});
