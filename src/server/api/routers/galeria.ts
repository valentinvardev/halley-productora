import { randomUUID } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "~/env";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { hashPassword } from "~/server/galerias";
import { borrarObjetos, s3Configurado, urlDeSubida } from "~/server/s3";

function linkGaleria(token: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/galeria/${token}`;
}

const TIPOS: Record<string, "imagen" | "video"> = {
  "image/jpeg": "imagen",
  "image/png": "imagen",
  "image/webp": "imagen",
  "image/avif": "imagen",
  "video/mp4": "video",
  "video/webm": "video",
};

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export const galeriaRouter = createTRPCRouter({
  /* ------------------------------------------------ galerías nativas (admin) */

  /** Las galerías sueltas que se comparten por link. */
  listarNativas: adminProcedure.query(async ({ ctx }) => {
    const gs = await ctx.db.galeria.findMany({
      where: { grupoId: null },
      orderBy: { creadoEn: "desc" },
      include: { _count: { select: { fotos: true } } },
    });
    return gs.map((g) => ({
      id: g.id,
      titulo: g.titulo,
      fotos: g._count.fotos,
      venceEl: g.venceEl,
      vigente: !g.venceEl || g.venceEl.getTime() > Date.now(),
      tienePassword: !!g.passwordHash,
      link: g.tokenPublico ? linkGaleria(g.tokenPublico) : null,
    }));
  }),

  /** Crea una galería nativa: link propio, vencimiento y contraseña opcional. */
  crearNativa: adminProcedure
    .input(
      z.object({
        titulo: z.string().min(2),
        dias: z.number().int().min(1).max(3650),
        password: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const vence = new Date();
      vence.setDate(vence.getDate() + input.dias);
      const galeria = await ctx.db.galeria.create({
        data: {
          titulo: input.titulo,
          tokenPublico: randomUUID(),
          venceEl: vence,
          passwordHash: input.password ? hashPassword(input.password) : null,
        },
      });
      return { id: galeria.id };
    }),

  /**
   * Edita una galería nativa. La contraseña tiene tres estados: no tocar (nada),
   * poner/cambiar (`password`), o sacar (`quitarPassword`). `dias` renueva el
   * vencimiento desde hoy.
   */
  actualizarNativa: adminProcedure
    .input(
      z.object({
        id: z.string(),
        titulo: z.string().min(2).optional(),
        dias: z.number().int().min(1).max(3650).optional(),
        password: z.string().min(1).optional(),
        quitarPassword: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const data: {
        titulo?: string;
        venceEl?: Date;
        passwordHash?: string | null;
      } = {};
      if (input.titulo) data.titulo = input.titulo;
      if (input.dias) {
        const v = new Date();
        v.setDate(v.getDate() + input.dias);
        data.venceEl = v;
      }
      if (input.quitarPassword) data.passwordHash = null;
      else if (input.password) data.passwordHash = hashPassword(input.password);

      await ctx.db.galeria.update({ where: { id: input.id }, data });
      return { ok: true };
    }),

  /** Borra una galería nativa y sus fotos del bucket. */
  eliminarNativa: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const fotos = await ctx.db.fotoGaleria.findMany({
        where: { galeriaId: input.id },
      });
      if (fotos.length > 0) await borrarObjetos(fotos.map((f) => f.s3Key));
      await ctx.db.galeria.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  /* ------------------------------------------------------------ fotos (ambas) */

  /** Las fotos de una galería, para administrarlas. */
  listar: adminProcedure
    .input(z.object({ galeriaId: z.string() }))
    .query(async ({ ctx, input }) => {
      const fotos = await ctx.db.fotoGaleria.findMany({
        where: { galeriaId: input.galeriaId },
        orderBy: [{ orden: "asc" }, { creadoEn: "asc" }],
      });
      return fotos.map((f) => ({
        id: f.id,
        nombre: f.nombre,
        tipo: f.tipo === "video" ? ("video" as const) : ("imagen" as const),
        url: `/api/galeria/${f.id}`,
      }));
    }),

  /** Firma la subida directa a S3 de una foto de galería. */
  urlDeSubida: adminProcedure
    .input(
      z.object({
        galeriaId: z.string(),
        contentType: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!s3Configurado()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Falta configurar S3.",
        });
      }
      const tipo = TIPOS[input.contentType];
      if (!tipo) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Formato no admitido.",
        });
      }
      const galeria = await ctx.db.galeria.findUnique({
        where: { id: input.galeriaId },
      });
      if (!galeria) throw new TRPCError({ code: "NOT_FOUND" });

      const key = `galeria/${input.galeriaId}/${randomUUID()}.${EXT[input.contentType]}`;
      const { url } = await urlDeSubida(key, input.contentType);
      return { url, key, tipo };
    }),

  /** Registra la foto una vez subida, guardando su nombre original. */
  guardarFoto: adminProcedure
    .input(
      z.object({
        galeriaId: z.string(),
        s3Key: z.string(),
        nombre: z.string(),
        tipo: z.enum(["imagen", "video"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ultima = await ctx.db.fotoGaleria.findFirst({
        where: { galeriaId: input.galeriaId },
        orderBy: { orden: "desc" },
      });
      const foto = await ctx.db.fotoGaleria.create({
        data: {
          galeriaId: input.galeriaId,
          s3Key: input.s3Key,
          nombre: input.nombre.slice(0, 200),
          tipo: input.tipo,
          orden: (ultima?.orden ?? -1) + 1,
        },
      });
      return { id: foto.id };
    }),

  eliminarFotos: adminProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const fotos = await ctx.db.fotoGaleria.findMany({
        where: { id: { in: input.ids } },
      });
      if (fotos.length === 0) return { borrados: 0 };

      await borrarObjetos(fotos.map((f) => f.s3Key));
      const { count } = await ctx.db.fotoGaleria.deleteMany({
        where: { id: { in: fotos.map((f) => f.id) } },
      });
      return { borrados: count };
    }),
});
