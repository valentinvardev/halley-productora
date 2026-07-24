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
import { simuladorMpActivo, simuladorTaloActivo } from "~/server/demo";
import { aprobarPagoMockMp, mercadoPago } from "~/server/mercadopago";
import { proveedorDeGrupo } from "~/server/pagos";
import { registrarTransferenciaSimulada } from "~/server/talo";

/**
 * Arranca un pago por Checkout Pro: crea la preferencia con el monto exacto y
 * devuelve la URL de Mercado Pago a la que hay que mandar a la familia. El cobro
 * va a la cuenta del socio que tenga asignada el grupo.
 */
async function crearPreferenciaPago(
  alumnoId: string,
  opciones: {
    hastaCuotaId?: string;
    /** Cobra sólo la próxima cuota, no el plan entero. Es lo que muestra el
     *  link sin login, donde no hay selector de cuotas. */
    soloProxima?: boolean;
    emailPagador?: string;
  },
) {
  const alumno = await db.alumno.findUniqueOrThrow({
    where: { id: alumnoId },
    include: { grupo: { include: { cuotas: { orderBy: { numero: "asc" } } } }, pagos: true },
  });

  const { proveedor, cuenta } = await proveedorDeGrupo(alumno.grupoId);
  if (proveedor !== "MERCADOPAGO" || !cuenta) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Este grupo no cobra por Mercado Pago.",
    });
  }

  const plan = imputarPagos(alumno.grupo.cuotas, sumarPagos(alumno.pagos));
  // `soloProxima` recorta hasta la primera impaga: es el monto que ve la familia
  // en el link. Si no, respeta el `hastaCuotaId` del panel (o el plan entero).
  const hastaId = opciones.soloProxima
    ? plan.proxima?.id
    : opciones.hastaCuotaId;
  const hasta = hastaId ? plan.cuotas.find((c) => c.id === hastaId) : null;
  const alcanzadas = hasta
    ? plan.cuotas.filter((c) => c.numero <= hasta.numero)
    : plan.cuotas;
  const aSaldar = alcanzadas.filter((c) => c.saldo > 0);
  const monto = aSaldar.reduce((t, c) => t + c.saldo, 0);

  if (monto <= 0.01) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No hay saldo pendiente para cobrar.",
    });
  }

  const numeros = aSaldar.map((c) => c.numero);
  const descripcion = `${alumno.grupo.nombre} — ${
    numeros.length > 1 ? `cuotas ${numeros.join(", ")}` : `cuota ${numeros[0]}`
  } · ${alumno.nombre}`;

  // La cuenta que cobra viaja en la urlWebhook: es lo que después le dice al
  // webhook con qué token confirmar el pago.
  const urlWebhook = `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago?cuenta=${cuenta.id}`;

  const pref = await mercadoPago.crearPreferencia(cuenta.credencial, {
    monto,
    descripcion,
    referenciaExterna: alumno.id,
    urlRetorno: `${env.NEXT_PUBLIC_APP_URL}/mi/pagar/${alumno.id}`,
    urlWebhook,
    emailPagador: opciones.emailPagador,
  });

  return { urlPago: pref.urlPago, monto };
}

/**
 * Simulador de transferencias — sólo con TALO_MODE=mock.
 *
 * Registra la transferencia como si la familia hubiese transferido desde su
 * banco y después le pega al webhook real (`POST /api/webhooks/talo`) con el
 * mismo payload que manda Talo. El resto del sistema no se entera de que fue
 * simulado: el pago entra por el mismo camino que va a usar en producción.
 */
async function simularTransferencia(alumnoId: string, montoManual?: number) {
  // Sin esto, cualquiera con el token de una familia se da por pagado sin
  // transferir un peso —y de paso se destraba la galería—. Por eso la puerta
  // está cerrada en producción salvo que se abra a propósito.
  if (!simuladorTaloActivo()) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No disponible.",
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
    .input(
      z.object({
        alumnoId: z.string(),
        /** Para pagar varias cuotas juntas desde la pantalla de cobro. */
        monto: z.number().positive().optional(),
      }),
    )
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

      return simularTransferencia(input.alumnoId, input.monto);
    }),

  /** Desde el panel del padre: arranca el pago por Checkout Pro de un hijo. */
  crearPreferencia: cuentaProcedure
    .input(
      z.object({
        alumnoId: z.string(),
        hastaCuotaId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const vinculo = await ctx.db.tutor.findUnique({
        where: {
          cuentaId_alumnoId: {
            cuentaId: ctx.cuenta.id,
            alumnoId: input.alumnoId,
          },
        },
      });
      if (!vinculo) throw new TRPCError({ code: "NOT_FOUND" });

      return crearPreferenciaPago(input.alumnoId, {
        hastaCuotaId: input.hastaCuotaId,
        emailPagador: ctx.cuenta.email,
      });
    }),

  /** Desde el link sin login, con el token del alumno. */
  crearPreferenciaDesdeToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const alumno = await ctx.db.alumno.findUnique({
        where: { token: input.token },
        select: { id: true, emailContacto: true },
      });
      if (!alumno) throw new TRPCError({ code: "NOT_FOUND" });

      return crearPreferenciaPago(alumno.id, {
        soloProxima: true,
        emailPagador: alumno.emailContacto ?? undefined,
      });
    }),

  /**
   * Sólo en modo mock: la pantalla demo de Checkout Pro confirma el pago.
   * Aprueba la transacción simulada y la procesa por el mismo camino que el
   * webhook real, para que el resto del sistema no note la diferencia.
   */
  confirmarPagoDemoMp: publicProcedure
    .input(z.object({ pagoId: z.string() }))
    .mutation(async ({ input }) => {
      if (!simuladorMpActivo()) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No disponible." });
      }
      const { cuentaPagoId } = await aprobarPagoMockMp(input.pagoId);

      // Le pega al webhook real con el mismo payload que manda MP: el pago entra
      // por el camino de producción, no por un atajo.
      const res = await fetch(
        `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago?cuenta=${cuentaPagoId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "payment", data: { id: input.pagoId } }),
        },
      );
      if (!res.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `El webhook respondió ${res.status}`,
        });
      }
      return { ok: true };
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
