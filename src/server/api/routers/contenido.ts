import { randomUUID } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { HERO, esCategoria, esSubible } from "~/app/_datos/categorias";
import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import { muestraDe } from "~/server/contenido";
import { origenDe, permitirRafaga } from "~/server/limite-intentos";
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

  /**
   * Fotos para el costado de las pantallas de acceso.
   *
   * Es pública porque las pantallas de acceso son públicas: quien todavía no
   * entró es justamente quien la ve. No expone nada nuevo, son las mismas fotos
   * y las mismas direcciones que la portada muestra a cualquiera. Sólo
   * miniaturas y sólo imágenes: un cubo que gira no es lugar para un video.
   *
   * Se toman de a seis de cada tipo de evento y se entremezclan, así el mosaico
   * no sale con las nueve primeras del mismo casamiento.
   */
  /**
   * Un like a una foto del portfolio, sin sesión.
   *
   * Es un contador público y anónimo, así que la única defensa contra un bucle
   * que lo infle es el freno por origen: un cupo de likes por minuto por IP, y
   * un solo like por foto por IP por hora. Ninguno de los dos es infranqueable
   * (una red de teléfonos comparte IP; un atacante puede rotarla), pero suben
   * el costo de hacer trampa muy por encima de lo que vale un número en una
   * vitrina, que es la medida justa para esto.
   *
   * Devuelve el total nuevo. Si el freno lo para, devuelve el total sin tocar y
   * `contado: false`, para que la pantalla no mienta.
   */
  darLike: publicProcedure
    .input(z.object({ id: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const origen = origenDe(ctx.headers);
      const pasaCupo = permitirRafaga(`like:${origen}`, 30, 60_000);
      const pasaFoto = permitirRafaga(
        `like:${origen}:${input.id}`,
        1,
        60 * 60_000,
      );
      if (!pasaCupo || !pasaFoto) {
        const actual = await ctx.db.contenido.findUnique({
          where: { id: input.id },
          select: { likes: true },
        });
        return { likes: actual?.likes ?? 0, contado: false };
      }
      try {
        const fila = await ctx.db.contenido.update({
          where: { id: input.id },
          data: { likes: { increment: 1 } },
          select: { likes: true },
        });
        return { likes: fila.likes, contado: true };
      } catch {
        // Una foto que ya no existe: no hay nada que contar.
        throw new TRPCError({ code: "NOT_FOUND" });
      }
    }),

  muestraAcceso: publicProcedure.query(async () => {
    const porCategoria = await Promise.all(
      ["egresados", "bodas", "quince"].map((c) => muestraDe(c, 6)),
    );
    const salida: { id: string; url: string }[] = [];
    for (let i = 0; i < 6; i++) {
      for (const lista of porCategoria) {
        const p = lista[i];
        if (p && p.tipo === "imagen") salida.push({ id: p.id, url: p.urlMini });
      }
    }
    return salida;
  }),

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
        titulo: c.titulo,
        descripcion: c.descripcion,
      }));
    }),

  /**
   * El título y la descripción de una pieza.
   *
   * Los usa la página de videos de cada servicio. Vacío se guarda como nulo y
   * no como cadena vacía, para que la página pueda preguntar "¿tiene título?"
   * sin tener que distinguir entre no tener y tener uno en blanco.
   */
  editarTexto: adminProcedure
    .input(
      z.object({
        id: z.string(),
        titulo: z.string().trim().max(80),
        descripcion: z.string().trim().max(400),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.contenido.update({
        where: { id: input.id },
        data: {
          titulo: input.titulo || null,
          descripcion: input.descripcion || null,
        },
      });
      return { ok: true };
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
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Categoría inválida.",
        });
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
        // Las mide el navegador al subir. Opcionales porque un formato que no
        // sepa decodificar deja la pieza sin medidas, y ahí la mide el servidor
        // la primera vez que alguien abre la categoría.
        ancho: z.number().int().positive().max(100_000).optional(),
        alto: z.number().int().positive().max(100_000).optional(),
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
          ancho: input.ancho ?? null,
          alto: input.alto ?? null,
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
   * Deja la categoría en el orden que llega.
   *
   * Es la mutación del arrastre: el panel manda la lista entera ya acomodada y
   * acá se numera de cero en adelante. Mandar la lista y no "esta pieza va al
   * lugar N" es lo que hace que dos arrastres seguidos no se pisen: cada uno
   * describe el resultado completo, no un movimiento relativo a un estado que
   * quizás ya cambió.
   *
   * Si falta o sobra alguna pieza respecto de la categoría, se rechaza entero.
   * Numerar sólo las que vinieron dejaría a las otras con números viejos que
   * se mezclan con los nuevos, y el orden resultante no sería el que nadie
   * pidió.
   */
  reordenar: adminProcedure
    .input(
      z.object({
        categoria: z.string(),
        ids: z.array(z.string()).min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actuales = await ctx.db.contenido.findMany({
        where: { categoria: input.categoria },
        select: { id: true },
      });
      const esperados = new Set(actuales.map((c) => c.id));
      const recibidos = new Set(input.ids);
      const coinciden =
        esperados.size === recibidos.size &&
        [...esperados].every((id) => recibidos.has(id));
      if (!coinciden) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "La categoría cambió mientras ordenabas. Recargá y probá de nuevo.",
        });
      }

      // Una sola sentencia y no una actualización por pieza. Con treinta fotos,
      // treinta idas y vueltas a una base que está lejos tardaban entre cinco y
      // ocho segundos, y ese tiempo es una ventana en la que un segundo arrastre
      // puede llegar antes de que el primero termine. Un UPDATE con la tabla de
      // valores adentro es un viaje, y además es atómico sin transacción.
      //
      // Va con marcadores numerados y no con la plantilla `Prisma.sql`: en el
      // bundle de desarrollo el cliente y los helpers salían de dos copias del
      // módulo generado, y el fragmento llegaba a la base como texto literal
      // con un "$1" adentro. Acá el texto de la consulta lo arma este código
      // con marcadores solamente, y cada valor viaja como parámetro: no hay
      // nada del usuario metido en el SQL.
      const filas = input.ids
        .map((_, i) => `($${i * 2 + 1}::text, $${i * 2 + 2}::int)`)
        .join(", ");
      const parametros = input.ids.flatMap((id, i) => [id, i]);
      await ctx.db.$executeRawUnsafe(
        `UPDATE "Contenido" AS c SET "orden" = v.orden ` +
          `FROM (VALUES ${filas}) AS v(id, orden) ` +
          `WHERE c.id = v.id AND c.categoria = $${parametros.length + 1}::text`,
        ...parametros,
        input.categoria,
      );
      return { ok: true };
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
      const fila = await ctx.db.contenido.findUnique({
        where: { id: input.id },
      });
      if (!fila || fila.categoria !== HERO) return { ok: true };
      await borrarObjetos([fila.s3Key]);
      await ctx.db.contenido.delete({ where: { id: fila.id } });
      return { ok: true };
    }),

  /** Vuelve la portada al video de respaldo que vive en el repo. */
  quitarHero: adminProcedure.mutation(async ({ ctx }) => {
    const previas = await ctx.db.contenido.findMany({
      where: { categoria: HERO },
    });
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
