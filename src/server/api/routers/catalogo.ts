import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { PrismaClient } from "../../../../generated/prisma";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  CLAVES_PARAMETRO,
  PARTES,
  parametrosPresupuesto,
  sembrarCatalogo,
  urlImagen,
} from "~/server/catalogo";

/**
 * La edición del catálogo del simulador, desde el panel.
 *
 * Todo lo que el simulador ofrece —qué se puede contratar, cómo se describe,
 * cuánto sale, con qué foto— se maneja acá. La razón de que exista este router
 * es que nada de eso es código: un precio cambia por temporada y un texto se
 * reescribe cuando alguien encuentra una forma mejor de decirlo, y pedir un
 * deploy para cada uno garantiza que se dejen de tocar.
 *
 * Lo que sí sigue en el código es la estructura: que haya tres partes, que la
 * primera admita combinar y que el pago tenga cuatro planes. Eso no es un dato
 * del negocio sino el diseño del wizard, y cambiarlo es rediseñarlo.
 */

/** Dónde caen las fotos que se suben desde el editor del catálogo. */
export const CATEGORIA_IMAGENES = "presupuesto";

const evento = z.enum(["quince", "boda"]);
const parte = z.enum(PARTES);

/** El texto de un ítem, tal como se edita. */
const campos = {
  nombre: z.string().trim().min(2).max(80),
  texto: z.string().trim().min(3).max(400),
  precio: z.number().int().min(0).max(1_000_000_000),
  imagenId: z.string().nullable(),
};

/**
 * La clave con la que un ítem viaja en un presupuesto emitido.
 *
 * Se deriva del nombre la primera vez y después no se toca: los presupuestos ya
 * generados guardan sus líneas con esta clave, así que si cambiara al renombrar
 * un ítem, reabrir uno viejo dejaría de reconocer lo que la persona había
 * elegido.
 */
function aClave(nombre: string) {
  const base = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "item";
}

/** Una clave libre dentro del evento; si está tomada, se le suma un número. */
async function claveLibre(db: PrismaClient, evento: string, nombre: string) {
  const base = aClave(nombre);
  for (let i = 0; i < 50; i++) {
    const clave = i === 0 ? base : `${base}-${i + 1}`;
    const tomada = await db.itemPresupuesto.findUnique({
      where: { evento_clave: { evento, clave } },
    });
    if (!tomada) return clave;
  }
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Ya hay demasiados ítems con ese nombre.",
  });
}

/** Al final de su parte, para que lo nuevo no se meta en el medio de la lista. */
async function proximoOrden(db: PrismaClient, evento: string, parte: string) {
  const ultimo = await db.itemPresupuesto.findFirst({
    where: { evento, parte },
    orderBy: { orden: "desc" },
  });
  return (ultimo?.orden ?? -1) + 1;
}

export const catalogoRouter = createTRPCRouter({
  /**
   * El catálogo entero de un evento, con lo apagado incluido.
   *
   * El simulador ve sólo lo activo; el panel ve todo, porque para volver a
   * encender algo primero hay que poder verlo.
   */
  listar: adminProcedure
    .input(z.object({ evento }))
    .query(async ({ ctx, input }) => {
      await sembrarCatalogo();

      const filas = await ctx.db.itemPresupuesto.findMany({
        where: { evento: input.evento },
        orderBy: [{ orden: "asc" }],
        include: { locaciones: { orderBy: { orden: "asc" } } },
      });

      return PARTES.map((p) => ({
        parte: p,
        items: filas
          .filter((f) => f.parte === p)
          .map((f) => ({
            id: f.id,
            clave: f.clave,
            nombre: f.nombre,
            texto: f.texto,
            precio: Number(f.precio),
            activo: f.activo,
            imagenId: f.imagenId,
            imagen: urlImagen(f.imagenId),
            locaciones: f.locaciones.map((l) => ({
              id: l.id,
              clave: l.clave,
              nombre: l.nombre,
              texto: l.texto,
              extra: Number(l.extra),
              imagenId: l.imagenId,
              imagen: urlImagen(l.imagenId),
            })),
          })),
      }));
    }),

  crearItem: adminProcedure
    .input(z.object({ evento, parte, ...campos }))
    .mutation(async ({ ctx, input }) => {
      const clave = await claveLibre(ctx.db, input.evento, input.nombre);
      const orden = await proximoOrden(ctx.db, input.evento, input.parte);

      const item = await ctx.db.itemPresupuesto.create({
        data: {
          evento: input.evento,
          parte: input.parte,
          clave,
          nombre: input.nombre,
          texto: input.texto,
          precio: input.precio,
          imagenId: input.imagenId,
          orden,
        },
      });
      return { id: item.id };
    }),

  /** La clave no está: se fija al crear y no se toca nunca más. */
  editarItem: adminProcedure
    .input(z.object({ id: z.string(), ...campos }))
    .mutation(({ ctx, input }) =>
      ctx.db.itemPresupuesto.update({
        where: { id: input.id },
        data: {
          nombre: input.nombre,
          texto: input.texto,
          precio: input.precio,
          imagenId: input.imagenId,
        },
      }),
    ),

  activarItem: adminProcedure
    .input(z.object({ id: z.string(), activo: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.db.itemPresupuesto.update({
        where: { id: input.id },
        data: { activo: input.activo },
      }),
    ),

  /**
   * Sube o baja un ítem dentro de su parte.
   *
   * Intercambia el `orden` con el vecino en vez de renumerar la lista entera:
   * dos escrituras en vez de N, y el resto de las filas no se toca.
   */
  moverItem: adminProcedure
    .input(z.object({ id: z.string(), direccion: z.enum(["sube", "baja"]) }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.itemPresupuesto.findUnique({
        where: { id: input.id },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      const sube = input.direccion === "sube";
      const vecino = await ctx.db.itemPresupuesto.findFirst({
        where: {
          evento: item.evento,
          parte: item.parte,
          orden: sube ? { lt: item.orden } : { gt: item.orden },
        },
        orderBy: { orden: sube ? "desc" : "asc" },
      });
      if (!vecino) return { ok: true };

      await ctx.db.$transaction([
        ctx.db.itemPresupuesto.update({
          where: { id: item.id },
          data: { orden: vecino.orden },
        }),
        ctx.db.itemPresupuesto.update({
          where: { id: vecino.id },
          data: { orden: item.orden },
        }),
      ]);
      return { ok: true };
    }),

  /**
   * Borrar de verdad, y por eso el panel pregunta antes.
   *
   * Los presupuestos ya emitidos no se tocan: guardan sus líneas con el precio
   * adentro, así que siguen diciendo lo que decían. Lo único que se pierde es
   * la posibilidad de que alguien reabra uno viejo y lo vuelva a elegir.
   */
  eliminarItem: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.itemPresupuesto.delete({ where: { id: input.id } }),
    ),

  /* ------------------------------------------------------------ locaciones */

  guardarLocacion: adminProcedure
    .input(
      z.object({
        /** Con `id` se edita; sin él, se crea dentro de `itemId`. */
        id: z.string().optional(),
        itemId: z.string(),
        nombre: z.string().trim().min(2).max(80),
        texto: z.string().trim().min(3).max(400),
        extra: z.number().int().min(0).max(1_000_000_000),
        imagenId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        return ctx.db.locacionPresupuesto.update({
          where: { id: input.id },
          data: {
            nombre: input.nombre,
            texto: input.texto,
            extra: input.extra,
            imagenId: input.imagenId,
          },
        });
      }

      const ultima = await ctx.db.locacionPresupuesto.findFirst({
        where: { itemId: input.itemId },
        orderBy: { orden: "desc" },
      });

      // La clave se busca libre dentro del ítem, igual que la del ítem dentro
      // del evento: es lo que queda escrito en los presupuestos emitidos.
      const base = aClave(input.nombre);
      let clave = base;
      for (let i = 1; i < 50; i++) {
        const tomada = await ctx.db.locacionPresupuesto.findUnique({
          where: { itemId_clave: { itemId: input.itemId, clave } },
        });
        if (!tomada) break;
        clave = `${base}-${i + 1}`;
      }

      return ctx.db.locacionPresupuesto.create({
        data: {
          itemId: input.itemId,
          clave,
          nombre: input.nombre,
          texto: input.texto,
          extra: input.extra,
          imagenId: input.imagenId,
          orden: (ultima?.orden ?? -1) + 1,
        },
      });
    }),

  eliminarLocacion: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.locacionPresupuesto.delete({ where: { id: input.id } }),
    ),

  /* ------------------------------------------------------------- imágenes */

  /**
   * Todo lo que hay para elegir como foto de un ítem.
   *
   * Son las piezas que ya se subieron a la vitrina más las que se subieron
   * desde acá. Reusar la misma tabla es lo que permite ofrecer "elegir una que
   * ya está" en vez de obligar a volver a subir la misma foto por segunda vez.
   *
   * Sólo imágenes: un video de fondo en una tarjeta de 76 píxeles no aporta
   * nada y pesa.
   */
  imagenes: adminProcedure.query(async ({ ctx }) => {
    const filas = await ctx.db.contenido.findMany({
      where: { tipo: "imagen" },
      orderBy: [{ categoria: "asc" }, { orden: "asc" }, { creadoEn: "asc" }],
      take: 400,
    });
    return filas.map((c) => ({
      id: c.id,
      categoria: c.categoria,
      url: `/api/contenido/${c.id}?m=1`,
    }));
  }),

  /** Registra una imagen recién subida y la deja lista para elegir. */
  guardarImagen: adminProcedure
    .input(
      z.object({ s3Key: z.string(), s3KeyMini: z.string().nullish() }),
    )
    .mutation(async ({ ctx, input }) => {
      const c = await ctx.db.contenido.create({
        data: {
          categoria: CATEGORIA_IMAGENES,
          s3Key: input.s3Key,
          s3KeyMini: input.s3KeyMini ?? null,
          tipo: "imagen",
          orden: 0,
        },
      });
      return { id: c.id, url: `/api/contenido/${c.id}?m=1` };
    }),

  /* ------------------------------------------------------------ parámetros */

  parametros: adminProcedure.query(() => parametrosPresupuesto()),

  guardarParametros: adminProcedure
    .input(
      z.object({
        reservaPorcentaje: z.number().min(0).max(1),
        reservaMinimo: z.number().int().min(0),
        boxUmbral: z.number().int().min(0),
        preciosConfirmados: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const valores: [string, string][] = [
        [CLAVES_PARAMETRO.reservaPorcentaje, String(input.reservaPorcentaje)],
        [CLAVES_PARAMETRO.reservaMinimo, String(input.reservaMinimo)],
        [CLAVES_PARAMETRO.boxUmbral, String(input.boxUmbral)],
        [
          CLAVES_PARAMETRO.preciosConfirmados,
          input.preciosConfirmados ? "si" : "no",
        ],
      ];

      await ctx.db.$transaction(
        valores.map(([clave, valor]) =>
          ctx.db.ajuste.upsert({
            where: { clave },
            create: { clave, valor },
            update: { valor },
          }),
        ),
      );
      return { ok: true };
    }),
});

