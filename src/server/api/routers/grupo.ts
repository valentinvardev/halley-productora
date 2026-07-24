import { z } from "zod";

import { crearAlumno } from "~/server/alumnos";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  DIA_VENCIMIENTO,
  imputarPagos,
  linkAlumno,
  linkGrupo,
  linkRegistroAlumno,
  sumarPagos,
} from "~/server/dominio";
import { simuladorTaloActivo } from "~/server/demo";
import { slugify } from "~/lib/slug";

type CuotaDb = { id: string; numero: number; monto: unknown; venceEl: Date };
type AlumnoDb = { pagos: { monto: unknown }[] };

/** Estado de cobranza del grupo entero, sumando el plan de cada alumno. */
function resumir(cuotas: CuotaDb[], alumnos: AlumnoDb[]) {
  let esperado = 0;
  let recaudado = 0;
  let alDia = 0;
  let conDeuda = 0;
  let vencidos = 0;

  for (const alumno of alumnos) {
    const plan = imputarPagos(cuotas, sumarPagos(alumno.pagos));
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
        alumnos: { select: { pagos: { select: { monto: true } } } },
      },
    });

    return grupos.map((g) => ({
      id: g.id,
      nombre: g.nombre,
      slug: g.slug,
      colegio: g.colegio,
      tipo: g.tipo,
      autoRegistro: g.autoRegistro,
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
        linkRegistro: linkGrupo(grupo.slug),
        modoDemo: simuladorTaloActivo(),
        cuentaPago: grupo.cuentaPago
          ? { id: grupo.cuentaPago.id, nombre: grupo.cuentaPago.nombre, proveedor: grupo.cuentaPago.proveedor }
          : null,
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
          const plan = imputarPagos(grupo.cuotas, sumarPagos(a.pagos));
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

  eliminar: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.grupo.delete({ where: { id: input.id } });
      return { ok: true };
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
