import { randomUUID } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { HERO, esCategoria, esSubible } from "~/app/_datos/categorias";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { borrarObjetos, s3Configurado, urlDeSubida } from "~/server/s3";

/**
 * Todo lo que hay en S3 de una pieza.
 *
 * Desde que las imágenes se suben con miniatura, cada pieza puede ser dos
 * objetos. Borrar sólo el grande dejaba la miniatura pagando espacio para
 * siempre, sin nada que la nombre.
 */
function clavesDe(fila: { s3Key: string; s3KeyMini: string | null }) {
  return fila.s3KeyMini ? [fila.s3Key, fila.s3KeyMini] : [fila.s3Key];
}

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
      if (!esSubible(input.categoria)) {
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
      const base = `contenido/${input.categoria}/${randomUUID()}`;
      const key = `${base}.${EXT[input.contentType]}`;
      const { url } = await urlDeSubida(key, input.contentType);

      // La miniatura cuelga del mismo id con otro sufijo, así se ve de un
      // vistazo a qué pieza pertenece. Sólo para imágenes: sacarle una miniatura
      // a un video en el navegador obliga a decodificarlo, que es justo lo que
      // se está tratando de evitar.
      let mini: { url: string; key: string } | null = null;
      if (tipo === "imagen") {
        const keyMini = `${base}-mini.webp`;
        const firma = await urlDeSubida(keyMini, "image/webp");
        mini = { url: firma.url, key: keyMini };
      }

      return { url, key, tipo, mini };
    }),

  /** Guarda la pieza una vez que el navegador terminó de subirla. */
  guardar: adminProcedure
    .input(
      z.object({
        categoria: z.string(),
        s3Key: z.string(),
        s3KeyMini: z.string().nullish(),
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
          s3KeyMini: input.s3KeyMini ?? null,
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
      await borrarObjetos(clavesDe(contenido));

      // Y antes de borrar la fila, soltar a quien la esté usando de foto: el
      // catálogo del simulador apunta a estas piezas por id, y una referencia
      // muerta se ve como un cuadrito roto en la tarjeta.
      await ctx.db.$transaction([
        ctx.db.itemPresupuesto.updateMany({
          where: { imagenId: input.id },
          data: { imagenId: null },
        }),
        ctx.db.opcionItem.updateMany({
          where: { imagenId: input.id },
          data: { imagenId: null },
        }),
        ctx.db.contenido.delete({ where: { id: input.id } }),
      ]);
      return { ok: true };
    }),

  /**
   * Hace de una pieza la portada de su categoría.
   *
   * La portada es la primera de la lista, y la lista ordena por `orden`. Así que
   * alcanza con ponerle un orden por debajo de todas: no hace falta un campo
   * aparte ni renumerar el resto.
   */
  marcarPortada: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const pieza = await ctx.db.contenido.findUnique({
        where: { id: input.id },
      });
      if (!pieza) throw new TRPCError({ code: "NOT_FOUND" });

      const { _min } = await ctx.db.contenido.aggregate({
        where: { categoria: pieza.categoria },
        _min: { orden: true },
      });
      await ctx.db.contenido.update({
        where: { id: input.id },
        data: { orden: (_min.orden ?? 0) - 1 },
      });
      return { ok: true };
    }),

  /**
   * Mueve una pieza un lugar dentro de su categoría.
   *
   * El orden importa: la vitrina muestra las fotos en este orden y la primera es
   * la portada. Hasta ahora lo único que se podía hacer era subir una pieza —que
   * cae al final— y ascender una a portada de un salto. Poner la tercera antes
   * que la segunda no tenía forma.
   *
   * Renumera la categoría entera en vez de intercambiar el `orden` de dos
   * piezas. Intercambiar es más barato y fue lo primero que escribí, pero contra
   * los datos reales no funciona: en la vitrina hay categorías donde las treinta
   * y una piezas tienen `orden = 0` —se subieron antes de que el campo se usara
   * en serio— y ahí no hay nada que intercambiar. Correr una de ellas un lugar
   * exigía darle un número por debajo o por encima de todo el bloque empatado, y
   * eso no la movía un lugar: la mandaba al principio o al final de la lista.
   *
   * Renumerando, el resultado es siempre exactamente "un lugar", haya empates,
   * huecos o los negativos que mete `marcarPortada`. Son cuarenta escrituras en
   * el peor caso, dentro de una transacción, en una acción que hace una persona
   * mirando una grilla: no es un camino caliente.
   *
   * De paso deja la categoría ordenada de 0 a N, así que el segundo movimiento
   * ya parte de datos sanos.
   *
   * Sin vecino no pasa nada. Es el borde de la lista, no un error: la primera no
   * puede subir más y la última no puede bajar.
   */
  moverContenido: adminProcedure
    .input(
      z.object({
        id: z.string(),
        direccion: z.enum(["sube", "baja"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const pieza = await ctx.db.contenido.findUnique({
        where: { id: input.id },
        select: { id: true, categoria: true },
      });
      if (!pieza) throw new TRPCError({ code: "NOT_FOUND" });

      // El mismo orden que ve el panel: `creadoEn` desempata a los que comparten
      // número, para que la lista de acá y la de la pantalla sean la misma.
      const lista = await ctx.db.contenido.findMany({
        where: { categoria: pieza.categoria },
        orderBy: [{ orden: "asc" }, { creadoEn: "asc" }],
        select: { id: true },
      });

      const desde = lista.findIndex((c) => c.id === pieza.id);
      const hasta = desde + (input.direccion === "sube" ? -1 : 1);
      if (desde === -1 || hasta < 0 || hasta >= lista.length) {
        return { ok: true, movido: false };
      }

      const reordenada = [...lista];
      [reordenada[desde], reordenada[hasta]] = [
        reordenada[hasta]!,
        reordenada[desde]!,
      ];

      await ctx.db.$transaction(
        reordenada.map((c, i) =>
          ctx.db.contenido.update({ where: { id: c.id }, data: { orden: i } }),
        ),
      );

      return { ok: true, movido: true };
    }),

  /**
   * Los clips de portada. Son varios a propósito: la landing elige uno al azar
   * en cada visita, así el sitio no abre siempre igual.
   */
  hero: adminProcedure.query(async ({ ctx }) => {
    const filas = await ctx.db.contenido.findMany({
      where: { categoria: HERO },
      orderBy: [{ orden: "asc" }, { creadoEn: "asc" }],
    });
    return filas.map((f) => ({
      id: f.id,
      tipo: f.tipo === "video" ? ("video" as const) : ("imagen" as const),
      url: `/api/contenido/${f.id}`,
    }));
  }),

  /**
   * Pone una pieza como portada del sitio y borra la que estaba.
   *
   * Hay una sola portada, así que reemplazar es la operación natural: si sólo
   * creara la nueva, la anterior quedaría ocupando espacio en el bucket sin que
   * nadie la vea nunca.
   */
  guardarHero: adminProcedure
    .input(
      z.object({
        s3Key: z.string(),
        tipo: z.enum(["imagen", "video"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Se suma al conjunto en vez de reemplazarlo: antes cada subida borraba
      // la anterior, y con eso no se podía tener más de una portada para
      // alternar.
      const ultima = await ctx.db.contenido.findFirst({
        where: { categoria: HERO },
        orderBy: { orden: "desc" },
      });

      const nueva = await ctx.db.contenido.create({
        data: {
          categoria: HERO,
          s3Key: input.s3Key,
          tipo: input.tipo,
          orden: (ultima?.orden ?? -1) + 1,
        },
      });

      return { id: nueva.id };
    }),

  /** Saca un clip de portada. Los demás siguen alternándose. */
  eliminarHero: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const fila = await ctx.db.contenido.findUnique({ where: { id: input.id } });
      if (!fila || fila.categoria !== HERO) return { ok: true };
      await borrarObjetos([fila.s3Key]);
      await ctx.db.contenido.delete({ where: { id: fila.id } });
      return { ok: true };
    }),

  /** Vuelve la portada al video de respaldo que vive en el repo. */
  quitarHero: adminProcedure.mutation(async ({ ctx }) => {
    const previas = await ctx.db.contenido.findMany({ where: { categoria: HERO } });
    if (previas.length === 0) return { ok: true };
    await borrarObjetos(previas.flatMap(clavesDe));
    await ctx.db.contenido.deleteMany({
      where: { id: { in: previas.map((p) => p.id) } },
    });
    return { ok: true };
  }),

  /** Borra varias de una: es lo que pide la selección múltiple de la galería. */
  eliminarVarios: adminProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const filas = await ctx.db.contenido.findMany({
        where: { id: { in: input.ids } },
      });
      if (filas.length === 0) return { borrados: 0 };

      await borrarObjetos(filas.flatMap(clavesDe));
      const { count } = await ctx.db.contenido.deleteMany({
        where: { id: { in: filas.map((f) => f.id) } },
      });
      return { borrados: count };
    }),
});
