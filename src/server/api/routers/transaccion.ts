import { z } from "zod";

import { TRPCError } from "@trpc/server";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { procesarPagoMercadoPago, procesarPagoRecibido } from "~/server/pagos";

/**
 * El libro de todo lo que pasó alrededor del dinero.
 *
 * Se arma con dos fuentes que se complementan: `Pago` —la plata que efectivamente
 * entró, desde el primer día— y `EventoPago` —los intentos, los avisos repetidos
 * y los que fallaron—. De los eventos se excluyen los de pago registrado, porque
 * esa plata ya viene por el otro lado y contarla dos veces sería mentir.
 *
 * El resultado es una sola lista ordenada por fecha donde se ve tanto lo que
 * salió bien como lo que no.
 */

type Fila = {
  id: string;
  fecha: Date;
  clase: "pago" | "evento";
  proveedor: string;
  tipo: string;
  resultado: string | null;
  falla: boolean;
  monto: number | null;
  alumno: string | null;
  alumnoId: string | null;
  grupo: string | null;
  grupoId: string | null;
  cuenta: string | null;
  refPago: string | null;
  cuota: number | null;
  detalle: string | null;
  /** Se puede volver a pedir: sólo las fallas con con qué reintentar. */
  reintentable: boolean;
  resuelto: boolean;
};

export const transaccionRouter = createTRPCRouter({
  listar: adminProcedure
    .input(
      z.object({
        limite: z.number().int().min(1).max(200).default(50),
        desplazamiento: z.number().int().min(0).default(0),
        /** "todo" | "pagos" | "fallas" */
        filtro: z.enum(["todo", "pagos", "fallas"]).default("todo"),
        busqueda: z.string().trim().default(""),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limite, desplazamiento, filtro, busqueda } = input;
      // Se traen de más de cada fuente porque después se mezclan y recortan: sin
      // ese margen, la página 2 se saltearía filas.
      const ventana = limite + desplazamiento;

      const q = busqueda
        ? { contains: busqueda, mode: "insensitive" as const }
        : undefined;

      const traerPagos = filtro !== "fallas";
      const traerEventos = filtro !== "pagos";

      const [pagos, eventos, totalPagos, totalEventos] = await Promise.all([
        traerPagos
          ? ctx.db.pago.findMany({
              where: q
                ? {
                    OR: [
                      { refPago: q },
                      { alumno: { nombre: q } },
                      { alumno: { grupo: { nombre: q } } },
                    ],
                  }
                : undefined,
              orderBy: { recibidoEn: "desc" },
              take: ventana,
              include: {
                cuota: true,
                alumno: { include: { grupo: { include: { cuentaPago: true } } } },
              },
            })
          : [],
        traerEventos
          ? ctx.db.eventoPago.findMany({
              where: {
                tipo: { not: "pago-registrado" },
                ...(filtro === "fallas" ? { falla: true, resueltoEn: null } : {}),
                ...(q
                  ? {
                      OR: [
                        { refPago: q },
                        { alumnoNombre: q },
                        { grupoNombre: q },
                        { resultado: q },
                      ],
                    }
                  : {}),
              },
              orderBy: { creadoEn: "desc" },
              take: ventana,
            })
          : [],
        traerPagos ? ctx.db.pago.count() : 0,
        traerEventos
          ? ctx.db.eventoPago.count({
              where: {
                tipo: { not: "pago-registrado" },
                ...(filtro === "fallas" ? { falla: true, resueltoEn: null } : {}),
              },
            })
          : 0,
      ]);

      const filas: Fila[] = [
        ...pagos.map((p) => ({
          id: `pago-${p.id}`,
          fecha: p.recibidoEn,
          clase: "pago" as const,
          // El proveedor no se guardó en los pagos viejos; se deduce del id.
          proveedor: p.refPago.startsWith("mp_") ? "MERCADOPAGO" : "TALO",
          tipo: "pago-registrado",
          resultado: null,
          falla: false,
          monto: Number(p.monto),
          alumno: p.alumno.nombre,
          alumnoId: p.alumnoId,
          grupo: p.alumno.grupo.nombre,
          grupoId: p.alumno.grupoId,
          cuenta: p.alumno.grupo.cuentaPago?.nombre ?? null,
          refPago: p.refPago,
          cuota: p.cuota?.numero ?? null,
          detalle: null,
          reintentable: false,
          resuelto: false,
        })),
        ...eventos.map((e) => ({
          id: `evento-${e.id}`,
          fecha: e.creadoEn,
          clase: "evento" as const,
          proveedor: e.proveedor,
          tipo: e.tipo,
          resultado: e.resultado,
          falla: e.falla,
          monto: e.monto === null ? null : Number(e.monto),
          alumno: e.alumnoNombre,
          alumnoId: e.alumnoId,
          grupo: e.grupoNombre,
          grupoId: e.grupoId,
          cuenta: e.cuentaNombre,
          refPago: e.refPago,
          cuota: null,
          detalle: e.detalle,
          reintentable:
            e.falla &&
            !e.resueltoEn &&
            !!e.refPago &&
            (!!e.refCliente || (e.proveedor === "TALO" && !!e.alumnoId)),
          resuelto: !!e.resueltoEn,
        })),
      ]
        .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
        .slice(desplazamiento, desplazamiento + limite);

      return {
        filas,
        total: totalPagos + totalEventos,
        hayMas: desplazamiento + limite < totalPagos + totalEventos,
      };
    }),

  /**
   * Vuelve a pedirle el pago al proveedor.
   *
   * Los avisos no se repiten solos: si uno falló por algo nuestro —una consulta
   * mal armada, credenciales que faltaban—, la plata ya está en el proveedor
   * pero el pago nunca se acredita. Esto rehace exactamente el mismo camino que
   * el webhook, con lo que quedó guardado del aviso original.
   */
  reintentar: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const id = input.id.replace(/^evento-/, "");
      const ev = await ctx.db.eventoPago.findUnique({ where: { id } });
      if (!ev) throw new TRPCError({ code: "NOT_FOUND" });

      // La contraparte se guarda desde que existe el campo; para los avisos
      // anteriores se deduce del alumno, que es de donde salía igual. Así los
      // que ya estaban fallados también se pueden reintentar.
      const cliente =
        ev.refCliente ??
        (ev.proveedor === "TALO" && ev.alumnoId
          ? ((
              await ctx.db.alumno.findUnique({
                where: { id: ev.alumnoId },
                select: { taloCustomerId: true },
              })
            )?.taloCustomerId ?? null)
          : null);

      if (!ev.refPago || !cliente) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Este aviso no guardó con qué volver a pedirlo.",
        });
      }

      const res =
        ev.proveedor === "MERCADOPAGO"
          ? await procesarPagoMercadoPago({
              pagoId: ev.refPago,
              cuentaPagoId: cliente,
            })
          : await procesarPagoRecibido({
              transactionId: ev.refPago,
              customerId: cliente,
            });

      // Sólo se da por resuelto si esta vez entró: si volvió a fallar, tiene que
      // seguir figurando para mirar. "Duplicado" también cuenta como resuelto —
      // significa que el pago ya está registrado, que es lo que se buscaba.
      if (res.ok) {
        await ctx.db.eventoPago.update({
          where: { id },
          data: { resueltoEn: new Date() },
        });
      }

      return { ok: res.ok, motivo: res.motivo };
    }),

  /** Los números de arriba: cuánto entró y qué hay para mirar. */
  resumen: adminProcedure.query(async ({ ctx }) => {
    const [agregado, cantidad, fallas] = await Promise.all([
      ctx.db.pago.aggregate({ _sum: { monto: true } }),
      ctx.db.pago.count(),
      ctx.db.eventoPago.count({ where: { falla: true, resueltoEn: null } }),
    ]);
    return {
      recaudado: Number(agregado._sum.monto ?? 0),
      pagos: cantidad,
      fallas,
    };
  }),
});
