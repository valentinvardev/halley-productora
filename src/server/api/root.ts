import { ajusteRouter } from "~/server/api/routers/ajuste";
import { alumnoRouter } from "~/server/api/routers/alumno";
import { contenidoRouter } from "~/server/api/routers/contenido";
import { cuentaPagoRouter } from "~/server/api/routers/cuenta-pago";
import { cuentaRouter } from "~/server/api/routers/cuenta";
import { demoRouter } from "~/server/api/routers/demo";
import { grupoRouter } from "~/server/api/routers/grupo";
import { notificacionRouter } from "~/server/api/routers/notificacion";
import { pagoRouter } from "~/server/api/routers/pago";
import { publicoRouter } from "~/server/api/routers/publico";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  grupo: grupoRouter,
  alumno: alumnoRouter,
  cuenta: cuentaRouter,
  publico: publicoRouter,
  pago: pagoRouter,
  notificacion: notificacionRouter,
  demo: demoRouter,
  contenido: contenidoRouter,
  ajuste: ajusteRouter,
  cuentaPago: cuentaPagoRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.grupo.listar();
 */
export const createCaller = createCallerFactory(appRouter);
