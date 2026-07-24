import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { listarCuentas, marcarPorDefecto } from "~/server/cuentas-pago";

const proveedor = z.enum(["TALO", "MERCADOPAGO"]);

export const cuentaPagoRouter = createTRPCRouter({
  /** Las cuentas, con la credencial enmascarada. */
  listar: adminProcedure.query(() => listarCuentas()),

  crear: adminProcedure
    .input(
      z.object({
        nombre: z.string().trim().min(2),
        proveedor,
        credencial: z.string().trim().min(8),
        apiUrl: z.string().trim().url().optional().or(z.literal("")),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // La primera que se carga queda por defecto: sin eso, agregar una cuenta
      // y no marcarla dejaría los cobros sin ruta.
      const cuantas = await ctx.db.cuentaPago.count();

      const cuenta = await ctx.db.cuentaPago.create({
        data: {
          nombre: input.nombre,
          proveedor: input.proveedor,
          credencial: input.credencial,
          apiUrl: input.apiUrl ?? null,
          porDefecto: cuantas === 0,
        },
      });
      return { id: cuenta.id };
    }),

  /** La credencial sólo se toca si viene una nueva: en blanco se deja la que había. */
  actualizar: adminProcedure
    .input(
      z.object({
        id: z.string(),
        nombre: z.string().trim().min(2).optional(),
        credencial: z.string().trim().min(8).optional(),
        apiUrl: z.string().trim().url().optional().or(z.literal("")),
        activa: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...cambios } = input;
      await ctx.db.cuentaPago.update({
        where: { id },
        data: {
          ...(cambios.nombre ? { nombre: cambios.nombre } : {}),
          ...(cambios.credencial ? { credencial: cambios.credencial } : {}),
          ...(cambios.apiUrl !== undefined ? { apiUrl: cambios.apiUrl || null } : {}),
          ...(cambios.activa !== undefined ? { activa: cambios.activa } : {}),
        },
      });
      return { ok: true };
    }),

  porDefecto: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await marcarPorDefecto(input.id);
      return { ok: true };
    }),

  eliminar: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cuenta = await ctx.db.cuentaPago.findUnique({
        where: { id: input.id },
        include: { _count: { select: { grupos: true } } },
      });
      if (!cuenta) throw new TRPCError({ code: "NOT_FOUND" });

      // Borrar una cuenta con grupos colgando dejaría esos cobros sin destino
      // sin que nadie se entere. Primero hay que reasignarlos.
      if (cuenta._count.grupos > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `La usan ${cuenta._count.grupos} grupo(s). Cambiales la cuenta antes de borrarla.`,
        });
      }

      await ctx.db.cuentaPago.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
