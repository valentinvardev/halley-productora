import { randomUUID } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { AJUSTES, contacto, type ClaveAjuste } from "~/server/ajustes";
import { borrarObjetos, s3Configurado, urlDeSubida } from "~/server/s3";
import {
  BLOQUES_ORDEN,
  guardarBloque,
  restaurarBloque,
  todosLosBloques,
  type IdBloque,
} from "~/server/textos-sitio";

const CLAVES = Object.keys(AJUSTES) as [ClaveAjuste, ...ClaveAjuste[]];

export const ajusteRouter = createTRPCRouter({
  /** Lo que hay guardado hoy, con los valores por defecto donde falte. */
  obtener: adminProcedure.query(() => contacto()),

  /**
   * Guarda los ajustes que vinieron. Un upsert por clave: guardar uno no pisa
   * los otros.
   */
  guardar: adminProcedure
    .input(z.record(z.enum(CLAVES), z.string().trim()))
    .mutation(async ({ ctx, input }) => {
      const entradas = Object.entries(input) as [ClaveAjuste, string][];

      await Promise.all(
        entradas.map(([clave, valor]) =>
          ctx.db.ajuste.upsert({
            where: { clave },
            update: { valor },
            create: { clave, valor },
          }),
        ),
      );

      return contacto();
    }),

  /* ------------------------------------------------- sonido propio */

  /**
   * Firma la subida del sonido propio del aviso.
   *
   * Mismo camino que las fotos: el navegador hace el PUT directo a S3 y el
   * archivo no pasa por acá. La key la elige el servidor, así nadie decide
   * dónde cae.
   */
  urlDeSubidaSonido: adminProcedure
    .input(
      z.object({
        contentType: z.enum([
          "audio/mpeg",
          "audio/mp4",
          "audio/wav",
          "audio/x-wav",
          "audio/ogg",
          "audio/webm",
        ]),
      }),
    )
    .mutation(async ({ input }) => {
      if (!s3Configurado()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Falta configurar S3 para poder subir un sonido.",
        });
      }
      const ext = {
        "audio/mpeg": "mp3",
        "audio/mp4": "m4a",
        "audio/wav": "wav",
        "audio/x-wav": "wav",
        "audio/ogg": "ogg",
        "audio/webm": "webm",
      }[input.contentType];
      const key = `sonidos/aviso-${randomUUID()}.${ext}`;
      const { url } = await urlDeSubida(key, input.contentType);
      return { url, key };
    }),

  /**
   * Guarda el sonido subido y lo deja elegido.
   *
   * Si había uno anterior, se borra de S3: un sonido de aviso reemplazado no
   * es algo a lo que alguien quiera volver, y dejarlo sería pagar por un
   * archivo que ya nadie nombra.
   */
  guardarSonido: adminProcedure
    .input(z.object({ key: z.string().startsWith("sonidos/").max(200) }))
    .mutation(async ({ ctx, input }) => {
      const previo = await ctx.db.ajuste.findUnique({
        where: { clave: "sonidoPagoKey" },
      });
      if (previo?.valor && previo.valor !== input.key) {
        await borrarObjetos([previo.valor]);
      }
      await ctx.db.$transaction([
        ctx.db.ajuste.upsert({
          where: { clave: "sonidoPagoKey" },
          update: { valor: input.key },
          create: { clave: "sonidoPagoKey", valor: input.key },
        }),
        ctx.db.ajuste.upsert({
          where: { clave: "sonidoPago" },
          update: { valor: "personalizado" },
          create: { clave: "sonidoPago", valor: "personalizado" },
        }),
      ]);
      return contacto();
    }),

  /** Saca el sonido propio. Si era el elegido, vuelve la campana. */
  quitarSonido: adminProcedure.mutation(async ({ ctx }) => {
    const previo = await ctx.db.ajuste.findUnique({
      where: { clave: "sonidoPagoKey" },
    });
    if (previo?.valor) await borrarObjetos([previo.valor]);
    const elegido = await ctx.db.ajuste.findUnique({
      where: { clave: "sonidoPago" },
    });
    await ctx.db.$transaction([
      ctx.db.ajuste.upsert({
        where: { clave: "sonidoPagoKey" },
        update: { valor: "" },
        create: { clave: "sonidoPagoKey", valor: "" },
      }),
      ...(elegido?.valor === "personalizado"
        ? [
            ctx.db.ajuste.update({
              where: { clave: "sonidoPago" },
              data: { valor: "campana" },
            }),
          ]
        : []),
    ]);
    return contacto();
  }),

  /* ------------------------------------------------- textos de la web */

  /** Los bloques de texto editables, con lo vigente y lo de fábrica. */
  textos: adminProcedure.query(() => todosLosBloques()),

  guardarTexto: adminProcedure
    .input(
      z.object({
        id: z.enum(BLOQUES_ORDEN as [IdBloque, ...IdBloque[]]),
        // Cada bloque tiene sus propios campos, así que el detalle se valida
        // adentro: `guardarBloque` descarta lo que no esté en el catálogo. Acá
        // sólo se corta el largo, para que nadie pegue un documento entero en
        // un titular.
        textos: z.record(z.string().max(60), z.string().trim().max(2000)),
      }),
    )
    .mutation(async ({ input }) => {
      await guardarBloque(input.id, input.textos);
      return { ok: true };
    }),

  restaurarTexto: adminProcedure
    .input(z.object({ id: z.enum(BLOQUES_ORDEN as [IdBloque, ...IdBloque[]]) }))
    .mutation(async ({ input }) => {
      await restaurarBloque(input.id);
      return { ok: true };
    }),
});
