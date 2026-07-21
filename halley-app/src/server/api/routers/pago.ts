import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "~/env";
import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import { montoDe } from "~/server/dominio";
import { registrarTransferenciaSimulada, taloEsMock } from "~/server/talo";

/**
 * Simulador de transferencias — sólo con TALO_MODE=mock.
 *
 * Registra la transferencia como si el padre hubiese transferido desde su banco
 * y después le pega al webhook real (`POST /api/webhooks/talo`) con el mismo
 * payload que manda Talo. El resto del sistema no se entera de que fue simulado:
 * el pago entra por el mismo camino que va a usar en producción.
 */
async function simularTransferencia(padreId: string, montoManual?: number) {
  if (!taloEsMock) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "El simulador sólo está disponible con TALO_MODE=mock.",
    });
  }

  const padre = await db.padre.findUniqueOrThrow({
    where: { id: padreId },
    include: { grupo: true },
  });

  const monto = montoManual ?? montoDe(padre, padre.grupo);
  const tx = await registrarTransferenciaSimulada(padre.taloCustomerId, monto);

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
  /** Simulación desde el panel (el admin fuerza el pago de un padre). */
  simular: adminProcedure
    .input(
      z.object({
        padreId: z.string(),
        /** Permite demostrar un pago parcial. */
        monto: z.number().positive().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return simularTransferencia(input.padreId, input.monto);
    }),

  /** Simulación desde la página del padre, con su token. */
  simularDesdeToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const padre = await ctx.db.padre.findUnique({
        where: { token: input.token },
        select: { id: true },
      });
      if (!padre) throw new TRPCError({ code: "NOT_FOUND" });

      return simularTransferencia(padre.id);
    }),

  recientes: adminProcedure
    .input(z.object({ limite: z.number().int().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      const pagos = await ctx.db.pago.findMany({
        orderBy: { recibidoEn: "desc" },
        take: input.limite,
        include: { padre: { include: { grupo: true } } },
      });

      return pagos.map((p) => ({
        id: p.id,
        monto: Number(p.monto),
        recibidoEn: p.recibidoEn,
        taloTransactionId: p.taloTransactionId,
        padre: p.padre.nombre,
        grupo: p.padre.grupo.nombre,
        grupoId: p.padre.grupoId,
      }));
    }),
});
