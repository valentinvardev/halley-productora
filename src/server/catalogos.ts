import "server-only";

import type { Paquete } from "~/app/_datos/paquetes";
import {
  EVENTOS_ORDEN,
  type Evento,
  type Parte,
} from "~/app/_datos/presupuesto";
import { catalogoDe, parametrosPresupuesto } from "./catalogo";
import { paquetesDe } from "./paquetes";

/**
 * Todo lo que el simulador necesita para arrancar, de una.
 *
 * Las tres páginas que lo montan piden exactamente lo mismo, y tenerlo escrito
 * tres veces era la clase de repetición que se desincroniza el día que hay que
 * agregar un cuarto dato.
 *
 * Vienen los dos catálogos y no sólo el del evento elegido porque el paso cero
 * deja cambiar de idea: pedir el otro en ese momento metería una espera en el
 * medio de una decisión que dura un segundo. Son dos listas de texto.
 */
export async function datosDelSimulador(): Promise<{
  catalogos: Record<Evento, Parte[]>;
  parametros: Awaited<ReturnType<typeof parametrosPresupuesto>>;
  /** Los prearmados activos de cada evento, para el paso previo. */
  paquetes: Record<Evento, Paquete[]>;
}> {
  const [porEvento, parametros] = await Promise.all([
    Promise.all(EVENTOS_ORDEN.map((e) => catalogoDe(e))),
    parametrosPresupuesto(),
  ]);

  const catalogos = Object.fromEntries(
    EVENTOS_ORDEN.map((e, i) => [e, porEvento[i]!]),
  ) as Record<Evento, Parte[]>;

  // Se resuelven contra el catálogo que ya está en la mano: leerlo otra vez
  // para esto sería pagar dos veces la misma consulta.
  const porEventoPaquetes = await Promise.all(
    EVENTOS_ORDEN.map((e) => paquetesDe(e, catalogos[e])),
  );
  const paquetes = Object.fromEntries(
    EVENTOS_ORDEN.map((e, i) => [
      e,
      // Al wizard no le interesa `activo`: todo lo que llega está activo.
      porEventoPaquetes[i]!.map(({ activo: _a, ...p }) => p),
    ]),
  ) as Record<Evento, Paquete[]>;

  return { catalogos, parametros, paquetes };
}
