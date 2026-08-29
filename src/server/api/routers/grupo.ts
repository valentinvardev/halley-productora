import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { crearAlumno } from "~/server/alumnos";
import { borrarObjetos } from "~/server/s3";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  DIA_VENCIMIENTO,
  imputarPagos,
  type AjusteCuota,
  linkAlumno,
  linkGrupo,
  linkRegistroAlumno,
  sumarPagos,
} from "~/server/dominio";
import { credencialesDeGrupo } from "~/server/talo";
import { simuladorTaloActivo } from "~/server/demo";
import { slugify } from "~/lib/slug";

type CuotaDb = {
  id: string;
  numero: number;
  monto: unknown;
  venceEl: Date;
};
type AlumnoDb = {
  pagos: { monto: unknown }[];
  ajustesCuota: AjusteCuota[];
};

/**
 * Estado de cobranza del grupo entero, sumando el plan de cada alumno.
 *
 * Suma alumno por alumno y no cuotas × alumnos, que es lo que permite que cada
 * familia tenga su propio precio sin que el total del grupo deje de cerrar.
 */
function resumir(cuotas: CuotaDb[], alumnos: AlumnoDb[]) {
  let esperado = 0;
  let recaudado = 0;
  let alDia = 0;
  let conDeuda = 0;
  let vencidos = 0;

  for (const alumno of alumnos) {
    const plan = imputarPagos(cuotas, alumno.ajustesCuota, sumarPagos(alumno.pagos));
    esperado += plan.total;
    recaudado += plan.pagado;

    if (plan.deuda === 0) alDia += 1;
    else conDeuda += 1;
    if (!plan.alDia) vencidos += 1;
  }

  return {
    alumnos: alumnos.length,
    cuotas: cuotas.length,
    alDia,
    conDeuda,
    vencidos,
    esperado,
    recaudado,
  };
}

export const grupoRouter = createTRPCRouter({
  listar: adminProcedure.query(async ({ ctx }) => {
    const grupos = await ctx.db.grupo.findMany({
      orderBy: { creadoEn: "desc" },
      include: {
        cuotas: true,
        alumnos: {
          select: { pagos: { select: { monto: true } }, ajustesCuota: true },
        },
      },
    });

    return grupos.map((g) => ({
      id: g.id,
      nombre: g.nombre,
      slug: g.slug,
      colegio: g.colegio,
      tipo: g.tipo,
      autoRegistro: g.autoRegistro,
      modoPrueba: g.modoPrueba,
      creadoEn: g.creadoEn,
      resumen: resumir(g.cuotas, g.alumnos),
    }));
  }),

  detalle: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const grupo = await ctx.db.grupo.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          cuentaPago: true,
          cuotas: { orderBy: { numero: "asc" } },
          galerias: { orderBy: { creadoEn: "desc" } },
          alumnos: {
            orderBy: { creadoEn: "asc" },
            include: {
              tutores: { include: { cuenta: true }, orderBy: { creadoEn: "asc" } },
              pagos: { orderBy: { recibidoEn: "desc" } },
              ajustesCuota: true,
            },
          },
        },
      });

      return {
        id: grupo.id,
        nombre: grupo.nombre,
        slug: grupo.slug,
        colegio: grupo.colegio,
        tipo: grupo.tipo,
        autoRegistro: grupo.autoRegistro,
        modoPrueba: grupo.modoPrueba,
        linkRegistro: linkGrupo(grupo.slug),
        modoDemo: simuladorTaloActivo(),
        cuentaPago: grupo.cuentaPago
          ? { id: grupo.cuentaPago.id, nombre: grupo.cuentaPago.nombre, proveedor: grupo.cuentaPago.proveedor }
          : null,
        /**
         * Si este grupo puede darle un CVU a un alumno nuevo.
         *
         * Crear un alumno le pide el CVU a Talo antes de escribir nada, y para
         * eso hacen falta credenciales: las de la cuenta asignada al grupo, o
         * las de la cuenta marcada por defecto, o las del entorno. Si no hay
         * ninguna, el alta explota con un error que llega al panel como "algo se
         * rompió" y no como "falta configurar esto".
         *
         * Se resuelve acá y viaja como un sí o un no. Nunca sale la credencial:
         * lo único que el panel necesita saber es si puede o no.
         */
        puedeAltaDeAlumnos: (await credencialesDeGrupo(grupo.id)) !== null,
        resumen: resumir(grupo.cuotas, grupo.alumnos),
        cuotas: grupo.cuotas.map((c) => ({
          id: c.id,
          numero: c.numero,
          monto: Number(c.monto),
          venceEl: c.venceEl,
        })),
        galerias: grupo.galerias.map((g) => ({
          id: g.id,
          titulo: g.titulo,
          linkDrive: g.linkDrive,
          venceEl: g.venceEl,
        })),
        alumnos: grupo.alumnos.map((a) => {
          const plan = imputarPagos(grupo.cuotas, a.ajustesCuota, sumarPagos(a.pagos));
          return {
            id: a.id,
            nombre: a.nombre,
            emailContacto: a.emailContacto,
            alias: a.alias,
            cvu: a.cvu,
            /** El que se le manda a la familia: crea la cuenta. */
            linkRegistro: linkRegistroAlumno(grupo.slug, a.id),
            /** Pago sin registrarse: sigue existiendo como salida de emergencia. */
            linkPago: linkAlumno(a.token),
            responsables: a.tutores.map((t) => ({
              id: t.id,
              email: t.cuenta.email,
            })),
            plan: {
              total: plan.total,
              pagado: plan.pagado,
              deuda: plan.deuda,
              aFavor: plan.aFavor,
              alDia: plan.alDia,
              cuotas: plan.cuotas,
              proxima: plan.proxima,
            },
            /**
             * Qué cuotas tiene arregladas aparte, para que el panel pueda
             * distinguirlas del precio del grupo.
             *
             * El plan de arriba ya viene con los montos resueltos, así que sin
             * esto no habría forma de saber si un $35.000 es el precio de todos
             * o el acuerdo de esta familia — y por lo tanto tampoco de ofrecer
             * volver al general.
             */
            ajustes: a.ajustesCuota.map((x) => ({
              cuotaId: x.cuotaId,
              monto: x.monto === null ? null : Number(x.monto),
              venceEl: x.venceEl,
            })),
            pagos: a.pagos.map((p) => ({
              id: p.id,
              monto: Number(p.monto),
              recibidoEn: p.recibidoEn,
              refPago: p.refPago,
            })),
          };
        }),
      };
    }),

  /**
   * Crea el grupo y su plan de cuotas de una vez: N cuotas del mismo monto,
   * una por mes a partir del primer vencimiento.
   */
  crear: adminProcedure
    .input(
      z.object({
        nombre: z.string().min(3),
        colegio: z.string().min(2),
        montoCuota: z.number().positive(),
        cantidadCuotas: z.number().int().min(1).max(36),
        primerVencimiento: z.date(),
        autoRegistro: z.boolean().default(true),
        cuentaPagoId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const base = slugify(input.nombre) || "grupo";
      let slug = base;
      let intento = 1;
      while (await ctx.db.grupo.findUnique({ where: { slug } })) {
        intento += 1;
        slug = `${base}-${intento}`;
      }

      const grupo = await ctx.db.grupo.create({
        data: {
          nombre: input.nombre,
          colegio: input.colegio,
          autoRegistro: input.autoRegistro,
          cuentaPagoId: input.cuentaPagoId ?? null,
          slug,
          cuotas: {
            create: Array.from({ length: input.cantidadCuotas }, (_, i) => {
              // Toda cuota vence el 20: es la fecha desde la que corre la mora.
              // El mes lo pone el admin; el día lo fija la regla.
              const vence = new Date(input.primerVencimiento);
              vence.setDate(DIA_VENCIMIENTO);
              vence.setMonth(vence.getMonth() + i);
              return { numero: i + 1, monto: input.montoCuota, venceEl: vence };
            }),
          },
        },
      });

      return { id: grupo.id, slug: grupo.slug };
    }),

  /**
   * Crea un cliente particular: una boda, un cumpleaños de 15. Es un grupo de
   * uno —mismo modelo que los egresados— con su propio plan de cuotas, que acá
   * van explícitas (una seña y un saldo no son iguales ni mensuales) en vez de
   * generadas. El único pagador es el cliente, con toda la maquinaria de alumno.
   */
  crearParticular: adminProcedure
    .input(
      z.object({
        cliente: z.string().min(2),
        evento: z.string().min(2),
        email: z.string().email().optional(),
        cuentaPagoId: z.string().optional(),
        cuotas: z
          .array(z.object({ monto: z.number().positive(), venceEl: z.date() }))
          .min(1)
          .max(36),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const base = slugify(input.cliente) || "cliente";
      let slug = base;
      let intento = 1;
      while (await ctx.db.grupo.findUnique({ where: { slug } })) {
        intento += 1;
        slug = `${base}-${intento}`;
      }

      // Se numeran de la más temprana a la más tardía: la imputación oldest-first
      // cuenta con que el número siga el orden de las fechas.
      const ordenadas = [...input.cuotas].sort(
        (a, b) => a.venceEl.getTime() - b.venceEl.getTime(),
      );

      const grupo = await ctx.db.grupo.create({
        data: {
          nombre: input.cliente,
          colegio: input.evento,
          tipo: "PARTICULAR",
          // Un particular no tiene link público de auto-registro: lo invita el
          // admin, uno solo.
          autoRegistro: false,
          cuentaPagoId: input.cuentaPagoId ?? null,
          slug,
          cuotas: {
            create: ordenadas.map((c, i) => ({
              numero: i + 1,
              monto: c.monto,
              venceEl: c.venceEl,
            })),
          },
        },
      });

      const { alumno } = await crearAlumno({
        grupoId: grupo.id,
        nombre: input.cliente,
        emailContacto: input.email ?? null,
      });

      return { id: grupo.id, slug: grupo.slug, alumnoId: alumno.id };
    }),

  actualizarCuota: adminProcedure
    .input(
      z.object({
        cuotaId: z.string(),
        monto: z.number().positive().optional(),
        venceEl: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { cuotaId, ...datos } = input;
      await ctx.db.cuota.update({ where: { id: cuotaId }, data: datos });
      return { ok: true };
    }),

  /**
   * El monto (o el vencimiento) que este alumno tiene para esta cuota.
   *
   * Guardar sólo la diferencia es lo que hace que el plan siga siendo del grupo:
   * si mañana Halley cambia el precio general, los que no tienen ajuste lo
   * heredan solos y los que sí lo tienen no se pisan.
   *
   * Mandar los dos campos en nulo borra el ajuste y devuelve al alumno al precio
   * del grupo. Es la forma de deshacer sin una mutación aparte.
   */
  ajustarCuotaAlumno: adminProcedure
    .input(
      z.object({
        alumnoId: z.string(),
        cuotaId: z.string(),
        monto: z.number().positive().nullable(),
        venceEl: z.date().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { alumnoId, cuotaId, monto, venceEl } = input;
      const llave = { alumnoId_cuotaId: { alumnoId, cuotaId } };

      if (monto === null && venceEl === null) {
        await ctx.db.cuotaAlumno.deleteMany({ where: { alumnoId, cuotaId } });
        return { ok: true, borrado: true };
      }

      await ctx.db.cuotaAlumno.upsert({
        where: llave,
        create: { alumnoId, cuotaId, monto, venceEl },
        update: { monto, venceEl },
      });
      return { ok: true, borrado: false };
    }),

  /**
   * El precio de este alumno, de una.
   *
   * Cargar a una familia con precio propio son trece ediciones sueltas —la seña
   * y doce cuotas— y en un curso de cuarenta eso no lo hace nadie. Acá se dice
   * "este alumno paga tanto por cuota" y se escriben todas juntas; la edición
   * fina de una cuota puntual sigue estando en `ajustarCuotaAlumno` para el que
   * la necesite.
   *
   * Pisa todas las cuotas del plan, la primera incluida. Si el grupo cobra seña,
   * ésa es la cuota 1 y tiene su propio monto: después de igualar a todas hay que
   * volver a ponerle el suyo con `ajustarCuotaAlumno`, que es la edición fina.
   */
  ajustarPlanAlumno: adminProcedure
    .input(
      z.object({
        alumnoId: z.string(),
        montoPorCuota: z.number().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const alumno = await ctx.db.alumno.findUniqueOrThrow({
        where: { id: input.alumnoId },
        select: { grupoId: true },
      });

      const cuotas = await ctx.db.cuota.findMany({
        where: { grupoId: alumno.grupoId },
        select: { id: true },
      });

      for (const cuota of cuotas) {
        await ctx.db.cuotaAlumno.upsert({
          where: {
            alumnoId_cuotaId: { alumnoId: input.alumnoId, cuotaId: cuota.id },
          },
          create: {
            alumnoId: input.alumnoId,
            cuotaId: cuota.id,
            monto: input.montoPorCuota,
          },
          update: { monto: input.montoPorCuota },
        });
      }

      return { ok: true, cuotas: cuotas.length };
    }),

  /**
   * Enciende o apaga el modo de prueba.
   *
   * Con esto en `true` los pagos del grupo se simulan: no tocan a ningún
   * proveedor y no mueve un peso. Sirve para ensayar el circuito entero en el
   * sistema de verdad, sin abrir la puerta en los demás grupos.
   */
  modoPrueba: adminProcedure
    .input(z.object({ id: z.string(), activo: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.grupo.update({
        where: { id: input.id },
        data: { modoPrueba: input.activo },
      });
      return { ok: true };
    }),

  /** Cambia a qué cuenta cobra un grupo. */
  asignarCuenta: adminProcedure
    .input(z.object({ id: z.string(), cuentaPagoId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.grupo.update({
        where: { id: input.id },
        data: { cuentaPagoId: input.cuentaPagoId },
      });
      return { ok: true };
    }),

  /**
   * Cuánto se lleva puesto borrar un grupo.
   *
   * Es para que el cartel de confirmación diga números y no una advertencia
   * genérica: lo que frena a alguien de borrar lo que no quería es leer "23
   * alumnos, 41 pagos", no leer "esta acción es irreversible".
   */
  loQueSeBorra: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const grupo = await ctx.db.grupo.findUnique({
        where: { id: input.id },
        include: {
          _count: { select: { alumnos: true, galerias: true, avisos: true } },
          alumnos: { select: { _count: { select: { pagos: true } } } },
          galerias: { select: { _count: { select: { fotos: true } } } },
        },
      });
      if (!grupo) throw new TRPCError({ code: "NOT_FOUND" });

      const pagos = grupo.alumnos.reduce((t, a) => t + a._count.pagos, 0);
      const fotos = grupo.galerias.reduce((t, g) => t + g._count.fotos, 0);
      return {
        alumnos: grupo._count.alumnos,
        galerias: grupo._count.galerias,
        avisos: grupo._count.avisos,
        pagos,
        fotos,
      };
    }),

  /**
   * Borra un grupo con todo lo que cuelga de él.
   *
   * Las filas se van solas: las relaciones están en cascada. Los archivos no.
   * Antes esto borraba la fila y dejaba las fotos de las galerías y de los avisos
   * en S3 para siempre, ocupando espacio sin una sola fila que las nombrara — o
   * sea, imposibles de encontrar después. Se juntan las claves primero, se
   * borran los objetos, y recién entonces la fila.
   *
   * Ese orden es a propósito: si S3 falla, el grupo sigue existiendo y se puede
   * reintentar. Al revés quedarían los archivos huérfanos, que es el estado del
   * que no se vuelve.
   */
  eliminar: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const grupo = await ctx.db.grupo.findUnique({
        where: { id: input.id },
        include: {
          galerias: { include: { fotos: true } },
          avisos: { include: { fotos: true } },
        },
      });
      if (!grupo) throw new TRPCError({ code: "NOT_FOUND" });

      const claves = [
        ...grupo.galerias.flatMap((g) =>
          g.fotos.flatMap((f) =>
            f.s3KeyMini ? [f.s3Key, f.s3KeyMini] : [f.s3Key],
          ),
        ),
        ...grupo.avisos.flatMap((a) => a.fotos.map((f) => f.s3Key)),
      ];
      if (claves.length > 0) await borrarObjetos(claves);

      await ctx.db.grupo.delete({ where: { id: input.id } });
      return { ok: true, archivos: claves.length };
    }),

  /* --------------------------------------------------------------- galería */

  guardarGaleria: adminProcedure
    .input(
      z.object({
        grupoId: z.string(),
        id: z.string().optional(),
        titulo: z.string().min(2),
        linkDrive: z.string().url().or(z.literal("")).optional(),
        venceEl: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const datos = {
        titulo: input.titulo,
        linkDrive: input.linkDrive || null,
        venceEl: input.venceEl ?? null,
      };

      if (input.id) {
        await ctx.db.galeria.update({ where: { id: input.id }, data: datos });
      } else {
        await ctx.db.galeria.create({
          data: { ...datos, grupoId: input.grupoId },
        });
      }
      return { ok: true };
    }),

  eliminarGaleria: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.galeria.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
