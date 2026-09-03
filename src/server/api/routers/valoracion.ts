import { randomUUID } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import { origenDe, permitirRafaga } from "~/server/limite-intentos";
import { borrarObjetos, s3Configurado, urlDeSubida } from "~/server/s3";
import {
  abrirValoracion,
  enviarValoracion,
  pedirValoracion,
} from "~/server/valoraciones";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const valoracionRouter = createTRPCRouter({
  /* ---------------------------------------------------------- admin */

  pedir: adminProcedure
    .input(z.object({ alumnoId: z.string() }))
    .mutation(({ input }) => pedirValoracion(input.alumnoId)),

  listar: adminProcedure.query(async ({ ctx }) => {
    const filas = await ctx.db.valoracion.findMany({
      orderBy: { creadoEn: "desc" },
      include: {
        alumno: { select: { nombre: true } },
        grupo: { select: { nombre: true } },
      },
    });
    return filas.map((v) => ({
      id: v.id,
      email: v.email,
      alumno: v.alumno?.nombre ?? null,
      grupo: v.grupo?.nombre ?? null,
      creadoEn: v.creadoEn,
      expiraEl: v.expiraEl,
      usadoEl: v.usadoEl,
      nombre: v.nombre,
      comentario: v.comentario,
      estrellas: v.estrellas,
      fotoUrl: v.fotoKey ? `/api/valoracion/${v.id}?admin=1` : null,
      publicada: v.publicada,
    }));
  }),

  publicar: adminProcedure
    .input(z.object({ id: z.string(), publicada: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const fila = await ctx.db.valoracion.findUnique({
        where: { id: input.id },
      });
      if (!fila) throw new TRPCError({ code: "NOT_FOUND" });
      // Publicar una que todavía no llegó no tiene sentido: no hay nada que
      // mostrar.
      if (!fila.usadoEl && input.publicada) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Todavía no la dejaron.",
        });
      }
      await ctx.db.valoracion.update({
        where: { id: input.id },
        data: { publicada: input.publicada },
      });
      return { ok: true };
    }),

  eliminar: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const fila = await ctx.db.valoracion.findUnique({
        where: { id: input.id },
      });
      if (!fila) throw new TRPCError({ code: "NOT_FOUND" });
      if (fila.fotoKey) await borrarObjetos([fila.fotoKey]);
      await ctx.db.valoracion.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  /* --------------------------------------------------------- público */

  /** Qué muestra el formulario, o por qué no. */
  abrir: publicProcedure
    .input(z.object({ token: z.string().min(10).max(200) }))
    .query(({ input }) => abrirValoracion(input.token)),

  /**
   * Firma la subida de la foto de perfil, atada al link.
   *
   * Sin el token no se firma nada: es lo que evita que el endpoint sirva para
   * subir cualquier cosa a S3. Y la key sale de acá y no del cliente, así que
   * nadie elige dónde cae el archivo.
   */
  urlDeSubidaFoto: publicProcedure
    .input(
      z.object({ token: z.string().min(10).max(200), contentType: z.string() }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!s3Configurado()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Sin almacenamiento.",
        });
      }
      const abierta = await abrirValoracion(input.token);
      if (!abierta.ok) throw new TRPCError({ code: "FORBIDDEN" });
      const ext = EXT[input.contentType];
      if (!ext)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Subí una JPG, PNG o WebP.",
        });
      // Un cupo chico por origen: es una foto por valoración, no una galería.
      if (
        !permitirRafaga(`valoracion-foto:${origenDe(ctx.headers)}`, 10, 60_000)
      ) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
      }
      const key = `valoraciones/${abierta.id}-${randomUUID()}.${ext}`;
      const { url } = await urlDeSubida(key, input.contentType);
      return { url, key };
    }),

  enviar: publicProcedure
    .input(
      z.object({
        token: z.string().min(10).max(200),
        nombre: z.string().trim().min(2).max(80),
        comentario: z.string().trim().min(10).max(1200),
        estrellas: z.number().int().min(1).max(5),
        fotoKey: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!permitirRafaga(`valoracion:${origenDe(ctx.headers)}`, 10, 60_000)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
      }
      // La key tiene que ser de esta valoración: sin este chequeo se podría
      // colgar una foto ajena o un objeto cualquiera del bucket.
      const abierta = await abrirValoracion(input.token);
      if (!abierta.ok) return abierta;
      const fotoKey =
        input.fotoKey && input.fotoKey.startsWith(`valoraciones/${abierta.id}-`)
          ? input.fotoKey
          : null;
      return enviarValoracion(input.token, { ...input, fotoKey });
    }),
});
