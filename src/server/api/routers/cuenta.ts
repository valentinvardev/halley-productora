import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  cuentaProcedure,
  publicProcedure,
} from "~/server/api/trpc";

import {
  MAX_RESPONSABLES,
  imputarPagos,
  linkAlumno,
  linkRegistroAlumno,
  sumarPagos,
} from "~/server/dominio";

import { taloEsMock } from "~/server/talo";

export const cuentaRouter = createTRPCRouter({
  /* ------------------------------------------------------- registro / login */

  /** Datos del grupo y lista de alumnos para el desplegable del registro. */
  grupoPorSlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const grupo = await ctx.db.grupo.findUnique({
        where: { slug: input.slug },
        include: {
          cuotas: { orderBy: { numero: "asc" } },
          alumnos: {
            orderBy: { nombre: "asc" },
            include: { _count: { select: { tutores: true } } },
          },
        },
      });
      if (!grupo?.autoRegistro) throw new TRPCError({ code: "NOT_FOUND" });

      const primera = grupo.cuotas[0];

      return {
        nombre: grupo.nombre,
        colegio: grupo.colegio,
        cuotas: grupo.cuotas.length,
        montoCuota: primera ? Number(primera.monto) : 0,
        primerVencimiento: primera?.venceEl ?? null,
        maxResponsables: MAX_RESPONSABLES,
        // Del alumno sólo sale el nombre y cuántos lugares quedan. Nada de
        // emails, montos ni tokens en una pantalla pública.
        alumnos: grupo.alumnos.map((a) => ({
          id: a.id,
          nombre: a.nombre,
          responsables: a._count.tutores,
          completo: a._count.tutores >= MAX_RESPONSABLES,
        })),
      };
    }),

  /* ----------------------------------------------------------- dashboard */

  yo: cuentaProcedure.query(({ ctx }) => ({
    email: ctx.cuenta.email,
    nombre: ctx.cuenta.nombre,
  })),

  /**
   * Saca a un responsable (o se va uno mismo). Todos los responsables pueden
   * hacerlo: son iguales entre sí.
   */
  quitarResponsable: cuentaProcedure
    .input(z.object({ tutorId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tutor = await ctx.db.tutor.findUnique({
        where: { id: input.tutorId },
      });
      if (!tutor) throw new TRPCError({ code: "NOT_FOUND" });

      // Sólo se puede tocar a los responsables de un alumno propio.
      const soyResponsable = await ctx.db.tutor.findUnique({
        where: {
          cuentaId_alumnoId: {
            cuentaId: ctx.cuenta.id,
            alumnoId: tutor.alumnoId,
          },
        },
      });
      if (!soyResponsable) throw new TRPCError({ code: "FORBIDDEN" });

      await ctx.db.tutor.delete({ where: { id: tutor.id } });
      return { ok: true };
    }),

  /* --------------------------------------------------------------- cobro */

  /**
   * La pantalla de pago: cuánto hay que transferir y a dónde.
   *
   * `hastaCuotaId` no significa "pagar sólo esa cuota". El dinero se imputa
   * siempre de la cuota más vieja a la más nueva —es la regla que hace que el
   * estado se derive de los pagos y no se pueda desincronizar—, así que elegir
   * la cuota 3 es ponerse al día hasta la 3. El monto lo dice explícito para
   * que nadie se sorprenda.
   */
  cobro: cuentaProcedure
    .input(
      z.object({
        alumnoId: z.string(),
        hastaCuotaId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // El `some` sobre tutores es la autorización: si no es responsable de
      // este alumno, no hay fila y no hay pantalla.
      const alumno = await ctx.db.alumno.findFirst({
        where: {
          id: input.alumnoId,
          tutores: { some: { cuentaId: ctx.cuenta.id } },
        },
        include: {
          grupo: { include: { cuotas: { orderBy: { numero: "asc" } } } },
          pagos: true,
        },
      });
      if (!alumno) throw new TRPCError({ code: "NOT_FOUND" });

      const plan = imputarPagos(alumno.grupo.cuotas, sumarPagos(alumno.pagos));

      const hasta = input.hastaCuotaId
        ? plan.cuotas.find((c) => c.id === input.hastaCuotaId)
        : null;
      if (input.hastaCuotaId && !hasta) throw new TRPCError({ code: "NOT_FOUND" });

      const alcanzadas = hasta
        ? plan.cuotas.filter((c) => c.numero <= hasta.numero)
        : plan.cuotas;
      const aSaldar = alcanzadas.filter((c) => c.saldo > 0);

      const monto = aSaldar.reduce((t, c) => t + c.saldo, 0);
      const primera = aSaldar[0];

      return {
        alumnoId: alumno.id,
        nombre: alumno.nombre,
        alias: alumno.alias,
        cvu: alumno.cvu,
        modoDemo: taloEsMock,
        reportoTransferenciaEl: alumno.reportoTransferenciaEl,
        grupo: {
          nombre: alumno.grupo.nombre,
          colegio: alumno.grupo.colegio,
        },
        monto,
        /** Con tolerancia de un centavo, igual que la imputación. */
        listo: monto <= 0.01,
        /** Qué cuotas cubre esta transferencia. */
        numeros: aSaldar.map((c) => c.numero),
        totalCuotas: plan.cuotas.length,
        venceEl: primera?.venceEl ?? null,
        vencida: aSaldar.some((c) => c.estado === "VENCIDA"),
        plan: {
          total: plan.total,
          pagado: plan.pagado,
          deuda: plan.deuda,
          cuotas: plan.cuotas,
        },
      };
    }),

  /** "Ya transferí": aviso de la familia, no confirma nada por sí solo. */
  reportarTransferencia: cuentaProcedure
    .input(z.object({ alumnoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db.alumno.updateMany({
        where: {
          id: input.alumnoId,
          tutores: { some: { cuentaId: ctx.cuenta.id } },
        },
        data: { reportoTransferenciaEl: new Date() },
      });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });

      return { ok: true };
    }),

  /** Todo lo que el padre necesita ver: sus hijos, sus cuotas y su galería. */
  panel: cuentaProcedure.query(async ({ ctx }) => {
    const alumnos = await ctx.db.alumno.findMany({
      where: { tutores: { some: { cuentaId: ctx.cuenta.id } } },
      orderBy: { creadoEn: "asc" },
      include: {
        grupo: {
          include: {
            cuotas: { orderBy: { numero: "asc" } },
            galerias: { orderBy: { creadoEn: "desc" } },
          },
        },
        tutores: {
          include: { cuenta: true },
          orderBy: { creadoEn: "asc" },
        },
        pagos: { orderBy: { recibidoEn: "desc" } },
      },
    });

    return alumnos.map((a) => {
      const plan = imputarPagos(a.grupo.cuotas, sumarPagos(a.pagos));

      return {
        id: a.id,
        nombre: a.nombre,
        alias: a.alias,
        cvu: a.cvu,
        link: linkAlumno(a.token),
        modoDemo: taloEsMock,
        grupo: {
          nombre: a.grupo.nombre,
          colegio: a.grupo.colegio,
          slug: a.grupo.slug,
        },
        /** Los otros papás: quién más está gestionando esta cuota. */
        responsables: a.tutores.map((t) => ({
          id: t.id,
          email: t.cuenta.email,
          soyYo: t.cuentaId === ctx.cuenta.id,
        })),
        lugaresLibres: MAX_RESPONSABLES - a.tutores.length,
        /** Para pasarle el link al otro papá/mamá. */
        linkRegistro: linkRegistroAlumno(a.grupo.slug, a.id),
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
        })),
        galerias: a.grupo.galerias.map((g) => ({
          id: g.id,
          titulo: g.titulo,
          linkDrive: g.linkDrive,
          venceEl: g.venceEl,
          vigente: !g.venceEl || g.venceEl.getTime() > Date.now(),
        })),
      };
    });
  }),
});
