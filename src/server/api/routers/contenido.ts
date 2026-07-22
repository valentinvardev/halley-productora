import { randomUUID } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { esCategoria } from "~/server/contenido";
import { borrarObjetos, s3Configurado, urlDeSubida } from "~/server/s3";

/** Sólo lo que sabemos servir y mostrar en la vitrina. */
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

export const contenidoRouter = createTRPCRouter({
  /** ¿Está S3 configurado? El panel muestra el aviso si no. */
  estado: adminProcedure.query(() => ({ s3: s3Configurado() })),

  /** El contenido cargado de una categoría, para administrarlo. */
  listar: adminProcedure
    .input(z.object({ categoria: z.string() }))
    .query(async ({ ctx, input }) => {
      const filas = await ctx.db.contenido.findMany({
        where: { categoria: input.categoria },
        orderBy: [{ orden: "asc" }, { creadoEn: "asc" }],
      });
      return filas.map((c) => ({
        id: c.id,
        tipo: c.tipo === "video" ? ("video" as const) : ("imagen" as const),
        url: `/api/contenido/${c.id}`,
      }));
    }),

  /**
   * Firma una subida directa a S3.
   *
   * Devuelve la URL a la que el navegador hace el PUT y la key con la que
   * después se guarda la pieza. El archivo no pasa por nuestro servidor.
   */
  urlDeSubida: adminProcedure
    .input(
      z.object({
        categoria: z.string(),
        contentType: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      if (!s3Configurado()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Falta configurar S3 (AWS_S3_BUCKET y las credenciales).",
        });
      }
      if (!esCategoria(input.categoria)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Categoría inválida." });
      }
      const tipo = TIPOS[input.contentType];
      if (!tipo) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Formato no admitido. Subí JPG, PNG, WebP o MP4.",
        });
      }

      // La key lleva la categoría y un id aleatorio: nunca dos archivos se
      // pisan, ni siquiera con el mismo nombre.
      const key = `contenido/${input.categoria}/${randomUUID()}.${EXT[input.contentType]}`;
      const { url } = await urlDeSubida(key, input.contentType);
      return { url, key, tipo };
    }),

  /** Guarda la pieza una vez que el navegador terminó de subirla. */
  guardar: adminProcedure
    .input(
      z.object({
        categoria: z.string(),
        s3Key: z.string(),
        tipo: z.enum(["imagen", "video"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!esCategoria(input.categoria)) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }
      // Al final de la categoría.
      const ultimo = await ctx.db.contenido.findFirst({
        where: { categoria: input.categoria },
        orderBy: { orden: "desc" },
      });
      const contenido = await ctx.db.contenido.create({
        data: {
          categoria: input.categoria,
          s3Key: input.s3Key,
          tipo: input.tipo,
          orden: (ultimo?.orden ?? -1) + 1,
        },
      });
      return { id: contenido.id };
    }),

  eliminar: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const contenido = await ctx.db.contenido.findUnique({
        where: { id: input.id },
      });
      if (!contenido) throw new TRPCError({ code: "NOT_FOUND" });

      // Primero el objeto de S3; recién después la fila. Si fallara S3, la fila
      // queda y se puede reintentar en vez de dejar el archivo huérfano.
      await borrarObjetos([contenido.s3Key]);
      await ctx.db.contenido.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
