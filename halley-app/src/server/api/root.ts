import { demoRouter } from "~/server/api/routers/demo";
import { grupoRouter } from "~/server/api/routers/grupo";
import { notificacionRouter } from "~/server/api/routers/notificacion";
import { padreRouter } from "~/server/api/routers/padre";
import { pagoRouter } from "~/server/api/routers/pago";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  grupo: grupoRouter,
  padre: padreRouter,
  pago: pagoRouter,
  notificacion: notificacionRouter,
  demo: demoRouter,
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
