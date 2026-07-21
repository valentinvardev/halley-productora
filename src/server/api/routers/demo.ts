import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { crearPadre, invitarPadre } from "~/server/padres";
import { procesarPagoRecibido } from "~/server/pagos";
import { registrarTransferenciaSimulada } from "~/server/talo";
import { slugify } from "~/lib/slug";

/**
 * Datos de demostración. Arma dos grupos con historia (uno al día, otro
 * vencido) pasando por los mismos caminos que usa el panel: alta en Talo,
 * invitación por email y pagos entrando por el procesador del webhook.
 */

const EN_DIAS = (dias: number) =>
  new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

const GRUPOS = [
  {
    nombre: "Egresados 2027 – Colegio San Martín",
    colegio: "Colegio San Martín",
    montoCuota: 45000,
    cuotaActual: 3,
    cuotasTotales: 6,
    venceEl: EN_DIAS(12),
    padres: [
      { nombre: "Fernando Ríos", email: "fernando.rios@mail.com", paga: true },
      { nombre: "Carla Pérez", email: "carla.perez@mail.com", paga: false },
      { nombre: "Marcelo Díaz", email: "marcelo.diaz@mail.com", paga: true },
      { nombre: "Lucía Bustos", email: "lucia.bustos@mail.com", paga: true },
      { nombre: "Andrés Ferreyra", email: "andres.ferreyra@mail.com", paga: false },
      { nombre: "Paula Sosa", email: "paula.sosa@mail.com", paga: false },
      { nombre: "Diego Molina", email: "diego.molina@mail.com", paga: true },
      { nombre: "Verónica Aguirre", email: "veronica.aguirre@mail.com", paga: false },
    ],
  },
  {
    nombre: "Egresados 2026 – Instituto Belgrano",
    colegio: "Instituto Belgrano",
    montoCuota: 38000,
    cuotaActual: 6,
    cuotasTotales: 6,
    venceEl: EN_DIAS(-6), // ya vencida: se ve la marca tachada
    padres: [
      { nombre: "Silvina Godoy", email: "silvina.godoy@mail.com", paga: true },
      { nombre: "Ramiro Ortega", email: "ramiro.ortega@mail.com", paga: false },
      { nombre: "Natalia Vega", email: "natalia.vega@mail.com", paga: false },
      { nombre: "Julián Castro", email: "julian.castro@mail.com", paga: true },
    ],
  },
];

export const demoRouter = createTRPCRouter({
  sembrar: adminProcedure.mutation(async ({ ctx }) => {
    let creados = 0;

    for (const plantilla of GRUPOS) {
      const { padres, ...datos } = plantilla;

      const slug = slugify(datos.nombre);
      if (await ctx.db.grupo.findUnique({ where: { slug } })) continue;

      const grupo = await ctx.db.grupo.create({ data: { ...datos, slug } });
      creados += 1;

      for (const p of padres) {
        const { padre } = await crearPadre({
          grupoId: grupo.id,
          nombre: p.nombre,
          email: p.email,
          origen: "ADMIN",
        });
        await invitarPadre(padre.id);

        if (p.paga) {
          // Mismo recorrido que un pago real: transacción en Talo y después el
          // procesador del webhook.
          const tx = await registrarTransferenciaSimulada(
            padre.taloCustomerId,
            Number(grupo.montoCuota),
          );
          await procesarPagoRecibido({
            transactionId: tx.transactionId,
            customerId: tx.customerId,
          });
        }
      }
    }

    return { creados };
  }),

  limpiar: adminProcedure.mutation(async ({ ctx }) => {
    await ctx.db.notificacion.deleteMany();
    await ctx.db.transaccionMockTalo.deleteMany();
    await ctx.db.grupo.deleteMany(); // arrastra padres y pagos
    return { ok: true };
  }),
});
