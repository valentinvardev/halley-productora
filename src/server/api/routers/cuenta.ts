import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  cuentaProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { crearEnlaceAcceso, normalizarEmail } from "~/server/cuentas";
import { imputarPagos, linkAlumno, sumarPagos } from "~/server/dominio";
import { notificarAcceso } from "~/server/notificaciones";
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
          alumnos: { orderBy: { nombre: "asc" } },
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
        // Del alumno sólo sale el nombre y si ya está tomado. Nada de emails,
        // montos ni tokens en una pantalla pública.
        alumnos: grupo.alumnos.map((a) => ({
          id: a.id,
          nombre: a.nombre,
          tomado: a.cuentaId !== null,
        })),
      };
    }),

  /** Registro: elige a su hijo y pide el link de acceso. */
  registrarse: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        alumnoId: z.string(),
        email: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const alumno = await ctx.db.alumno.findUnique({
        where: { id: input.alumnoId },
        include: { grupo: true },
      });

      if (!alumno || alumno.grupo.slug !== input.slug) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const email = normalizarEmail(input.email);

      // Primero que llega se lo queda: sin esto, dos personas reclamarían al
      // mismo alumno y la segunda vería los datos de la primera.
      if (alumno.cuentaId) {
        const dueño = await ctx.db.cuenta.findUnique({
          where: { id: alumno.cuentaId },
        });
        if (dueño?.email !== email) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Ese alumno ya fue registrado por otra cuenta. Si es un error, escribinos.",
          });
        }
      }

      const { url, minutos } = await crearEnlaceAcceso(email, {
        alumnoId: alumno.id,
      });
      await notificarAcceso(email, url, minutos);

      // En modo demo devolvemos el link para poder mostrar el flujo sin correo.
      return { email, url: taloEsMock ? url : null };
    }),

  /** Login: mismo mecanismo, sin alumno asociado. */
  entrar: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const email = normalizarEmail(input.email);
      const { url, minutos } = await crearEnlaceAcceso(email);
      await notificarAcceso(email, url, minutos);

      // Se responde igual exista o no la cuenta: si no, cualquiera podría
      // averiguar qué emails están registrados.
      return { email, url: taloEsMock ? url : null };
    }),

  /* ----------------------------------------------------------- dashboard */

  yo: cuentaProcedure.query(({ ctx }) => ({
    email: ctx.cuenta.email,
    nombre: ctx.cuenta.nombre,
  })),

  /** Todo lo que el padre necesita ver: sus hijos, sus cuotas y su galería. */
  panel: cuentaProcedure.query(async ({ ctx }) => {
    const alumnos = await ctx.db.alumno.findMany({
      where: { cuentaId: ctx.cuenta.id },
      orderBy: { creadoEn: "asc" },
      include: {
        grupo: {
          include: {
            cuotas: { orderBy: { numero: "asc" } },
            galerias: { orderBy: { creadoEn: "desc" } },
          },
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
        },
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
