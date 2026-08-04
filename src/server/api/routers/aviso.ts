import { randomUUID } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { borrarObjetos, s3Configurado, urlDeSubida } from "~/server/s3";

/**
 * Los avisos de un grupo: lo que la productora le quiere contar a las familias.
 *
 * Fechas, instrucciones, qué llevar el día de la sesión. Antes todo eso iba por
 * WhatsApp y se perdía entre mensajes; acá queda al lado de la cuota, que es
 * donde la familia ya entra.
 */

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export const avisoRouter = createTRPCRouter({
  listar: adminProcedure
    .input(z.object({ grupoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const avisos = await ctx.db.avisoGrupo.findMany({
        where: { grupoId: input.grupoId },
        orderBy: [{ orden: "asc" }, { creadoEn: "asc" }],
        include: { fotos: { orderBy: [{ orden: "asc" }, { creadoEn: "asc" }] } },
      });

      return avisos.map((a) => ({
        id: a.id,
        titulo: a.titulo,
        cuerpo: a.cuerpo,
        orden: a.orden,
        publicado: a.publicado,
        creadoEn: a.creadoEn,
        fotos: a.fotos.map((f) => ({
          id: f.id,
          nombre: f.nombre,
          url: `/api/aviso/${f.id}`,
        })),
      }));
    }),

  guardar: adminProcedure
    .input(
      z.object({
        id: z.string().optional(),
        grupoId: z.string(),
        titulo: z.string().trim().min(2).max(160),
        cuerpo: z.string().trim().max(8000),
        publicado: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        await ctx.db.avisoGrupo.update({
          where: { id: input.id },
          data: {
            titulo: input.titulo,
            cuerpo: input.cuerpo,
            publicado: input.publicado,
          },
        });
        return { id: input.id };
      }

      // El nuevo va al final: el admin ordena después si quiere.
      const ultimo = await ctx.db.avisoGrupo.findFirst({
        where: { grupoId: input.grupoId },
        orderBy: { orden: "desc" },
      });

      const aviso = await ctx.db.avisoGrupo.create({
        data: {
          grupoId: input.grupoId,
          titulo: input.titulo,
          cuerpo: input.cuerpo,
          publicado: input.publicado,
          orden: (ultimo?.orden ?? -1) + 1,
        },
      });
      return { id: aviso.id };
    }),

  /** Sube o baja un aviso en la lista, intercambiándolo con su vecino. */
  mover: adminProcedure
    .input(z.object({ id: z.string(), direccion: z.enum(["arriba", "abajo"]) }))
    .mutation(async ({ ctx, input }) => {
      const aviso = await ctx.db.avisoGrupo.findUnique({
        where: { id: input.id },
      });
      if (!aviso) throw new TRPCError({ code: "NOT_FOUND" });

      const vecino = await ctx.db.avisoGrupo.findFirst({
        where: {
          grupoId: aviso.grupoId,
          orden:
            input.direccion === "arriba"
              ? { lt: aviso.orden }
              : { gt: aviso.orden },
        },
        orderBy: { orden: input.direccion === "arriba" ? "desc" : "asc" },
      });
      if (!vecino) return { ok: true };

      // En una transacción: con el intercambio a medias quedarían dos avisos
      // reclamando la misma posición.
      await ctx.db.$transaction([
        ctx.db.avisoGrupo.update({
          where: { id: aviso.id },
          data: { orden: vecino.orden },
        }),
        ctx.db.avisoGrupo.update({
          where: { id: vecino.id },
          data: { orden: aviso.orden },
        }),
      ]);
      return { ok: true };
    }),

  eliminar: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const fotos = await ctx.db.fotoAviso.findMany({
        where: { avisoId: input.id },
      });
      if (fotos.length > 0) await borrarObjetos(fotos.map((f) => f.s3Key));
      await ctx.db.avisoGrupo.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  /* ------------------------------------------------------------------ fotos */

  urlDeSubida: adminProcedure
    .input(z.object({ avisoId: z.string(), contentType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!s3Configurado()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Falta configurar S3.",
        });
      }
      const ext = EXT[input.contentType];
      if (!ext) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "En los avisos sólo entran imágenes.",
        });
      }
      const aviso = await ctx.db.avisoGrupo.findUnique({
        where: { id: input.avisoId },
      });
      if (!aviso) throw new TRPCError({ code: "NOT_FOUND" });

      const key = `aviso/${input.avisoId}/${randomUUID()}.${ext}`;
      const { url } = await urlDeSubida(key, input.contentType);
      return { url, key };
    }),

  guardarFoto: adminProcedure
    .input(
      z.object({
        avisoId: z.string(),
        s3Key: z.string(),
        nombre: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ultima = await ctx.db.fotoAviso.findFirst({
        where: { avisoId: input.avisoId },
        orderBy: { orden: "desc" },
      });
      const foto = await ctx.db.fotoAviso.create({
        data: {
          avisoId: input.avisoId,
          s3Key: input.s3Key,
          nombre: input.nombre.slice(0, 200),
          orden: (ultima?.orden ?? -1) + 1,
        },
      });
      return { id: foto.id };
    }),

  eliminarFoto: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const foto = await ctx.db.fotoAviso.findUnique({ where: { id: input.id } });
      if (!foto) return { ok: true };
      await borrarObjetos([foto.s3Key]);
      await ctx.db.fotoAviso.delete({ where: { id: foto.id } });
      return { ok: true };
    }),
});
