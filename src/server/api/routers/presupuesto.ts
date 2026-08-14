import { randomInt } from "crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  ALFABETO_CODIGO,
  EVENTOS,
  PLANES,
  armarCodigo,
  cierreDe,
  lineasDe,
  totalDe,
  type Evento,
  type Linea,
} from "~/app/_datos/presupuesto";
import { env } from "~/env";
import { createTRPCRouter, adminProcedure, publicProcedure } from "~/server/api/trpc";
import { esperaRestante, registrarFallo, origenDe } from "~/server/limite-intentos";
import { notificarPresupuesto } from "~/server/notificaciones";

/**
 * El simulador de presupuesto.
 *
 * Es la única parte del sistema que le escribe a la base sin que haya nadie
 * autenticado del otro lado: cualquiera puede entrar a la web, armar su
 * presupuesto y emitirlo. Eso obliga a dos cosas que el resto de los routers no
 * necesitan.
 *
 * La primera es no creerle ni un peso al cliente. Del navegador llegan sólo los
 * ids de lo que eligió; el total, la reserva y las cuotas se calculan acá desde
 * el catálogo. Un total que viaja por la red es un total que se puede editar
 * antes de salir, y este además queda escrito en un documento que después se
 * usa para cobrar.
 *
 * La segunda es un freno. Sin límite, una sola persona con un script llena la
 * tabla y la bandeja de correo. Se usa el mismo contador que cuida las puertas
 * con contraseña: unas cuantas emisiones seguidas desde el mismo origen y
 * empieza a esperar cada vez más.
 */

const seleccion = z.object({
  evento: z.enum(["quince", "boda"]),
  items: z.array(z.string().max(60)).max(40),
  locaciones: z.record(z.string().max(60), z.string().max(60)),
});

/** Cuántas emisiones seguidas se toleran desde un mismo origen. */
const llaveFreno = (origen: string) => `presupuesto:${origen}`;

/** Un hash corto del alfabeto sin caracteres ambiguos. */
function hashCodigo(largo = 4) {
  let salida = "";
  for (let i = 0; i < largo; i++) {
    salida += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
  }
  return salida;
}

/**
 * Un código libre.
 *
 * El hash es aleatorio y corto, así que puede repetirse; en vez de confiar en
 * que no pase, se pregunta. Después de varios intentos se agranda el hash, que
 * es lo que hay que hacer cuando el espacio empieza a estar poblado y no
 * reintentar para siempre con el mismo largo.
 */
async function codigoLibre(
  db: { presupuesto: { findUnique: (a: { where: { codigo: string } }) => Promise<unknown> } },
  evento: Evento,
  nombre: string,
  anio: number,
) {
  for (let intento = 0; intento < 8; intento++) {
    const codigo = armarCodigo(evento, nombre, anio, hashCodigo(intento < 5 ? 4 : 6));
    if (!(await db.presupuesto.findUnique({ where: { codigo } }))) return codigo;
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "No se pudo generar un código único",
  });
}

/** Las líneas guardadas vuelven de la base como JSON: hay que reconocerlas. */
function leerLineas(valor: unknown): Linea[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((l) => {
    if (typeof l !== "object" || l === null) return [];
    const o = l as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.nombre !== "string") return [];
    return [
      {
        id: o.id,
        nombre: o.nombre,
        detalle: typeof o.detalle === "string" ? o.detalle : undefined,
        locacion: typeof o.locacion === "string" ? o.locacion : undefined,
        precio: Number(o.precio) || 0,
      },
    ];
  });
}

export const presupuestoRouter = createTRPCRouter({
  /**
   * Emitir el presupuesto.
   *
   * Devuelve el código, que es lo único que el cliente necesita: con él se abre
   * la página del presupuesto, que ya lee todo lo demás de la base.
   */
  generar: publicProcedure
    .input(
      seleccion.extend({
        nombre: z.string().trim().min(2).max(80),
        celular: z.string().trim().min(6).max(30),
        email: z.string().trim().email().max(120),
        quiereCopia: z.boolean(),
        /** "AAAA-MM-DD". Aproximada: se aclara en el paso que la pide. */
        fechaEvento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        plan: z.string().max(10),
        /**
         * Reeditar: el código de un presupuesto que ya existe.
         *
         * Se pisa en el lugar en vez de emitir uno nuevo, y el motivo es que el
         * precio no se congela al emitir sino al abonar la reserva. Mientras eso
         * no pasó, el presupuesto es un borrador y tener tres códigos de la
         * misma persona sólo complica la conversación.
         *
         * Quien tiene el código puede reescribirlo, igual que puede leerlo: el
         * código es la llave. Lo que hay del otro lado es una cotización sin
         * valor legal, no una cuenta.
         */
        codigo: z.string().trim().max(60).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const llave = llaveFreno(origenDe(ctx.headers));
      const espera = esperaRestante(llave);
      if (espera > 0) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Esperá ${espera} segundos antes de generar otro presupuesto.`,
        });
      }

      // Del cliente llegan ids; el precio sale del catálogo, siempre.
      const lineas = lineasDe(input.evento, {
        items: input.items,
        locaciones: input.locaciones,
      });
      if (lineas.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El presupuesto no tiene nada seleccionado.",
        });
      }

      const plan = PLANES.find((p) => p.id === input.plan) ?? PLANES[1]!;
      const cierre = cierreDe(totalDe(lineas), plan.id);

      // La fecha entra como texto local y se guarda al mediodía UTC: así no se
      // corre un día para ningún lado al mostrarla en Córdoba.
      const fechaEvento = input.fechaEvento
        ? new Date(`${input.fechaEvento}T12:00:00.000Z`)
        : null;

      const datos = {
        evento: input.evento,
        items: lineas,
        total: cierre.total,
        reserva: cierre.reserva,
        saldoFinanciado: cierre.saldoFinanciado,
        plan: plan.id,
        nombre: input.nombre,
        celular: input.celular,
        email: input.email,
        quiereCopia: input.quiereCopia,
        fechaEvento,
      };

      // Reeditar pisa el que ya estaba; si el código no existe —link viejo, o
      // alguien probando— se emite uno nuevo en vez de fallar.
      const previo = input.codigo
        ? await ctx.db.presupuesto.findUnique({
            where: { codigo: input.codigo.toUpperCase() },
            select: { id: true, codigo: true },
          })
        : null;

      const anio = (fechaEvento ?? new Date()).getFullYear();
      const codigo =
        previo?.codigo ??
        (await codigoLibre(ctx.db, input.evento, input.nombre, anio));

      const presupuesto = previo
        ? await ctx.db.presupuesto.update({ where: { id: previo.id }, data: datos })
        : await ctx.db.presupuesto.create({ data: { ...datos, codigo } });

      // Sólo cuenta contra el freno lo que crece o lo que sale hacia afuera:
      // una emisión nueva —que suma una fila— o una que manda correo. Reeditar
      // el propio presupuesto sin pedir copia pisa una fila que ya existe y no
      // le escribe a nadie, y trabar a quien está afinando lo que va a
      // contratar es frenar justo lo que se quiere que pase.
      if (!previo || input.quiereCopia) registrarFallo(llave);

      if (input.quiereCopia) {
        // Que falle el correo no puede tumbar la emisión: el presupuesto ya
        // existe y el código ya es válido. El error queda en la bandeja.
        try {
          await notificarPresupuesto({
            email: input.email,
            nombre: input.nombre,
            evento: EVENTOS[input.evento].posesivo,
            codigo,
            total: cierre.total,
            reserva: cierre.reserva,
            url: `${env.NEXT_PUBLIC_APP_URL}/presupuesto/codigo/${codigo}`,
          });
        } catch (e) {
          console.error("[presupuesto] no se pudo mandar la copia", e);
        }
      }

      return { codigo, creadoEn: presupuesto.creadoEn };
    }),

  /**
   * Un presupuesto por su código.
   *
   * Es público: el código *es* la llave. Por eso no devuelve el celular ni el
   * email completos —quien tiene el link ya los sabe si es el dueño, y si no lo
   * es, no tiene por qué leerlos—. Lo que sí devuelve entero es el detalle de
   * precios, que es a lo que vino.
   */
  porCodigo: publicProcedure
    .input(z.object({ codigo: z.string().trim().max(60) }))
    .query(async ({ ctx, input }) => {
      const p = await ctx.db.presupuesto.findUnique({
        where: { codigo: input.codigo.toUpperCase() },
      });
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });

      const lineas = leerLineas(p.items);

      return {
        codigo: p.codigo,
        evento: p.evento as Evento,
        lineas,
        total: Number(p.total),
        reserva: Number(p.reserva),
        saldoFinanciado: Number(p.saldoFinanciado),
        plan: p.plan,
        nombre: p.nombre,
        fechaEvento: p.fechaEvento,
        creadoEn: p.creadoEn,
      };
    }),

  /* ------------------------------------------------------------ el panel */

  listar: adminProcedure
    .input(
      z
        .object({ evento: z.enum(["quince", "boda"]).optional() })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const filas = await ctx.db.presupuesto.findMany({
        where: input?.evento ? { evento: input.evento } : undefined,
        orderBy: { creadoEn: "desc" },
        take: 200,
      });

      return filas.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        evento: p.evento as Evento,
        nombre: p.nombre,
        celular: p.celular,
        email: p.email,
        quiereCopia: p.quiereCopia,
        fechaEvento: p.fechaEvento,
        total: Number(p.total),
        reserva: Number(p.reserva),
        plan: p.plan,
        lineas: leerLineas(p.items),
        contactadoEn: p.contactadoEn,
        creadoEn: p.creadoEn,
      }));
    }),

  /** Marca (o desmarca) que Halley ya le escribió a esta persona. */
  marcarContactado: adminProcedure
    .input(z.object({ id: z.string(), contactado: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.db.presupuesto.update({
        where: { id: input.id },
        data: { contactadoEn: input.contactado ? new Date() : null },
      }),
    ),

  eliminar: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.presupuesto.delete({ where: { id: input.id } }),
    ),
});
