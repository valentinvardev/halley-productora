import "server-only";

import { EVENTOS_ORDEN, type Evento, type Parte } from "~/app/_datos/presupuesto";
import { catalogoDe, parametrosPresupuesto } from "./catalogo";

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
}> {
  const [porEvento, parametros] = await Promise.all([
    Promise.all(EVENTOS_ORDEN.map((e) => catalogoDe(e))),
    parametrosPresupuesto(),
  ]);

  const catalogos = Object.fromEntries(
    EVENTOS_ORDEN.map((e, i) => [e, porEvento[i]!]),
  ) as Record<Evento, Parte[]>;

  return { catalogos, parametros };
}
