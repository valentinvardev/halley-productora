import { randomUUID } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { borrarObjetos, s3Configurado, urlDeSubida } from "~/server/s3";

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
