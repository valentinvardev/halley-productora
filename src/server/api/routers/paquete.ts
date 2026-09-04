import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ICONOS_PAQUETE } from "~/app/_datos/paquetes";
import { lineasDe, sinCobertura } from "~/app/_datos/presupuesto";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { catalogoDe } from "~/server/catalogo";
import { paquetesDe } from "~/server/paquetes";

/**
 * Los presupuestos prearmados, desde el panel.
 *
 * Un paquete es una selección del catálogo con nombre, texto e ícono. Lo que
 * hay que poder hacer con él es lo mismo que con un ítem del catálogo: crearlo,
 * corregirlo, apagarlo sin borrarlo, ordenarlo y borrarlo. La lectura pública
 * no pasa por acá: las páginas del simulador la hacen en el servidor, junto con
 * el catálogo, para que el wizard arranque con todo de una.
 */

const evento = z.enum(["quince", "boda"]);

/** La misma forma que valida el router del presupuesto al emitir. */
const seleccion = z.object({
  items: z.array(z.string().max(60)).max(40),
  locaciones: z.record(z.string().max(60), z.string().max(60)),
  coberturas: z.record(z.string().max(60), z.array(z.string().max(60)).max(20)),
});

const campos = {
  nombre: z.string().trim().min(2).max(60),
  texto: z.string().trim().max(300),
  icono: z.enum(ICONOS_PAQUETE),
  seleccion,
};

/**
 * Un paquete tiene que ser algo que se pueda contratar tal cual.
 *
 * Es la misma regla que el wizard le impone a la persona y que el servidor
 * vuelve a comprobar al emitir: al menos un momento, cada momento con foto o
 * video, y una locación elegida donde haga falta. Guardar un paquete que no la
 * cumple sería ofrecer al público algo que al tocar "generar" va a fallar.
 */
async function comprobar(
  ev: "quince" | "boda",
  sel: z.infer<typeof seleccion>,
) {
  const partes = await catalogoDe(ev);
  const lineas = lineasDe(partes, sel);
  if (lineas.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "El paquete no tiene nada elegido del catálogo.",
    });
  }
  const momentos = partes.find((p) => p.id === "momentos");
  const hayMomento = momentos?.items.some((i) => sel.items.includes(i.id));
  if (!hayMomento) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "El paquete necesita al menos un momento para cubrir.",
    });
  }
  const faltan = sinCobertura(partes, sel);
  if (faltan.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Falta elegir con qué se cubre: ${faltan.map((i) => i.nombre).join(", ")}.`,
    });
  }
  const sinLugar = partes
    .flatMap((p) => p.items)
    .find(
      (i) =>
        sel.items.includes(i.id) &&
        i.locaciones?.length &&
        !sel.locaciones[i.id],
    );
  if (sinLugar) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Falta elegir dónde se hace ${sinLugar.nombre}.`,
    });
  }
}

export const paqueteRouter = createTRPCRouter({
  /** Todos los de un evento, apagados incluidos, ya resueltos contra el catálogo. */
  listar: adminProcedure
    .input(z.object({ evento }))
    .query(async ({ input }) => {
      const partes = await catalogoDe(input.evento);
      return paquetesDe(input.evento, partes, { soloActivos: false });
    }),

  crear: adminProcedure
    .input(z.object({ evento, ...campos }))
    .mutation(async ({ ctx, input }) => {
      await comprobar(input.evento, input.seleccion);
      const ultimo = await ctx.db.paquete.findFirst({
        where: { evento: input.evento },
        orderBy: { orden: "desc" },
      });
      const p = await ctx.db.paquete.create({
        data: {
          evento: input.evento,
          nombre: input.nombre,
          texto: input.texto,
          icono: input.icono,
          seleccion: input.seleccion,
          orden: (ultimo?.orden ?? -1) + 1,
        },
      });
      return { id: p.id };
    }),

  editar: adminProcedure
    .input(z.object({ id: z.string(), ...campos }))
    .mutation(async ({ ctx, input }) => {
      const existente = await ctx.db.paquete.findUnique({
        where: { id: input.id },
      });
      if (!existente) throw new TRPCError({ code: "NOT_FOUND" });
      const ev = existente.evento === "boda" ? "boda" : "quince";
      await comprobar(ev, input.seleccion);
      await ctx.db.paquete.update({
        where: { id: input.id },
        data: {
          nombre: input.nombre,
          texto: input.texto,
          icono: input.icono,
          seleccion: input.seleccion,
        },
      });
      return { ok: true };
    }),

  activar: adminProcedure
    .input(z.object({ id: z.string(), activo: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.db.paquete.update({
        where: { id: input.id },
        data: { activo: input.activo },
      }),
    ),

  /** Sube o baja uno intercambiando el orden con su vecino, como en el catálogo. */
  mover: adminProcedure
    .input(z.object({ id: z.string(), direccion: z.enum(["sube", "baja"]) }))
    .mutation(async ({ ctx, input }) => {
      const p = await ctx.db.paquete.findUnique({ where: { id: input.id } });
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });

      const sube = input.direccion === "sube";
      const vecino = await ctx.db.paquete.findFirst({
        where: {
          evento: p.evento,
          orden: sube ? { lt: p.orden } : { gt: p.orden },
        },
        orderBy: { orden: sube ? "desc" : "asc" },
      });
      if (!vecino) return { ok: true };

      await ctx.db.$transaction([
        ctx.db.paquete.update({
          where: { id: p.id },
          data: { orden: vecino.orden },
        }),
        ctx.db.paquete.update({
          where: { id: vecino.id },
          data: { orden: p.orden },
        }),
      ]);
      return { ok: true };
    }),

  /**
   * Borrar de verdad. Los presupuestos ya emitidos no lo referencian: guardan
   * sus líneas con el precio adentro, así que no se pierde nada de lo emitido.
   */
  eliminar: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.paquete.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
