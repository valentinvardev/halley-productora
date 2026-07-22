import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { crearAlumno, invitarFamilia } from "~/server/alumnos";
import { procesarPagoRecibido } from "~/server/pagos";
import { registrarTransferenciaSimulada } from "~/server/talo";
import { slugify } from "~/lib/slug";

/**
 * Datos de demostración. Arma dos grupos con historia pasando por los mismos
 * caminos que usa el panel: alta en Talo, invitación por email y pagos entrando
 * por el procesador del webhook.
 */

const EN_MESES = (meses: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + meses);
  d.setHours(12, 0, 0, 0);
  return d;
};

const GRUPOS = [
  {
    nombre: "Egresados 2027 – Colegio San Martín",
    colegio: "Colegio San Martín",
    montoCuota: 45000,
    cuotas: 6,
    // Arrancó hace dos meses: quedan cuotas pagadas atrás y otras por venir.
    primerVencimiento: EN_MESES(-2),
    galeria: {
      titulo: "Sesión de fotos — Egresados 2027",
      linkDrive: "https://drive.google.com/drive/folders/ejemplo-san-martin",
      mesesDeVida: 12,
    },
    alumnos: [
      { nombre: "Fernando Ríos", email: "fernando.rios@mail.com", cuotasPagas: 3 },
      { nombre: "Carla Pérez", email: "carla.perez@mail.com", cuotasPagas: 1 },
      { nombre: "Marcelo Díaz", email: "marcelo.diaz@mail.com", cuotasPagas: 3 },
      { nombre: "Lucía Bustos", email: "lucia.bustos@mail.com", cuotasPagas: 2 },
      {
        nombre: "Andrés Ferreyra",
        email: "andres.ferreyra@mail.com",
        cuotasPagas: 0,
      },
      { nombre: "Paula Sosa", email: "paula.sosa@mail.com", cuotasPagas: 3 },
      { nombre: "Diego Molina", email: "diego.molina@mail.com", cuotasPagas: 2 },
      {
        nombre: "Verónica Aguirre",
        email: "veronica.aguirre@mail.com",
        cuotasPagas: 0,
      },
    ],
  },
  {
    nombre: "Egresados 2026 – Instituto Belgrano",
    colegio: "Instituto Belgrano",
    montoCuota: 38000,
    cuotas: 3,
    primerVencimiento: EN_MESES(-4), // plan terminado: se ven los vencidos
    galeria: null,
    alumnos: [
      { nombre: "Silvina Godoy", email: "silvina.godoy@mail.com", cuotasPagas: 3 },
      { nombre: "Ramiro Ortega", email: "ramiro.ortega@mail.com", cuotasPagas: 1 },
      { nombre: "Natalia Vega", email: "natalia.vega@mail.com", cuotasPagas: 0 },
      { nombre: "Julián Castro", email: "julian.castro@mail.com", cuotasPagas: 3 },
    ],
  },
];

export const demoRouter = createTRPCRouter({
  sembrar: adminProcedure.mutation(async ({ ctx }) => {
    let creados = 0;

    for (const plantilla of GRUPOS) {
      const slug = slugify(plantilla.nombre);
      if (await ctx.db.grupo.findUnique({ where: { slug } })) continue;

      const grupo = await ctx.db.grupo.create({
        data: {
          nombre: plantilla.nombre,
          colegio: plantilla.colegio,
          slug,
          cuotas: {
            create: Array.from({ length: plantilla.cuotas }, (_, i) => {
              const vence = new Date(plantilla.primerVencimiento);
              vence.setMonth(vence.getMonth() + i);
              return {
                numero: i + 1,
                monto: plantilla.montoCuota,
                venceEl: vence,
              };
            }),
          },
          ...(plantilla.galeria
            ? {
                galerias: {
                  create: {
                    titulo: plantilla.galeria.titulo,
                    linkDrive: plantilla.galeria.linkDrive,
                    venceEl: EN_MESES(plantilla.galeria.mesesDeVida),
                  },
                },
              }
            : {}),
        },
      });
      creados += 1;

      for (const plantillaAlumno of plantilla.alumnos) {
        const { alumno } = await crearAlumno({
          grupoId: grupo.id,
          nombre: plantillaAlumno.nombre,
          emailContacto: plantillaAlumno.email,
        });
        await invitarFamilia(alumno.id);

        // Mismo recorrido que un pago real: transacción en Talo y después el
        // procesador del webhook, una vez por cuota paga.
        for (let i = 0; i < plantillaAlumno.cuotasPagas; i++) {
          const tx = await registrarTransferenciaSimulada(
            alumno.taloCustomerId,
            plantilla.montoCuota,
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
    await ctx.db.enlaceAcceso.deleteMany();
    await ctx.db.sesion.deleteMany();
    await ctx.db.cuenta.deleteMany();
    await ctx.db.grupo.deleteMany(); // arrastra cuotas, alumnos y pagos
    return { ok: true };
  }),
});
