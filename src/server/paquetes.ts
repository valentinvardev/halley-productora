import "server-only";

import {
  depurar,
  lineasDe,
  totalDe,
  type Evento,
  type Parte,
  type Seleccion,
} from "~/app/_datos/presupuesto";
import { esIconoPaquete, type Paquete } from "~/app/_datos/paquetes";

import { db } from "./db";

/**
 * Los paquetes de un evento, ya resueltos contra el catálogo.
 *
 * Resolver quiere decir dos cosas. Una, depurar la selección: un ítem que ya no
 * está en el catálogo (borrado, o apagado si se mira lo activo) se cae de la
 * lista en vez de romper la cuenta. Dos, calcular el total con las mismas
 * funciones del wizard, para que el número de la tarjeta sea exactamente el que
 * la persona va a ver al elegirlo.
 *
 * Recibe el catálogo en vez de leerlo, porque quien llama ya lo tiene en la mano
 * y leerlo dos veces sería pagar dos veces la misma consulta.
 */
export async function paquetesDe(
  evento: Evento,
  partes: Parte[],
  { soloActivos = true } = {},
): Promise<(Paquete & { activo: boolean })[]> {
  const filas = await db.paquete.findMany({
    where: { evento, ...(soloActivos ? { activo: true } : {}) },
    orderBy: { orden: "asc" },
  });

  return (
    filas
      .map((f) => {
        const seleccion = depurar(partes, leerSeleccion(f.seleccion));
        return {
          id: f.id,
          nombre: f.nombre,
          texto: f.texto,
          icono: esIconoPaquete(f.icono) ? f.icono : ("estrella" as const),
          seleccion,
          total: totalDe(lineasDe(partes, seleccion)),
          activo: f.activo,
        };
      })
      // Al público no se le ofrece un paquete que quedó vacío porque sus ítems
      // desaparecieron del catálogo: sería una tarjeta que no vende nada. El
      // panel sí lo ve, para poder arreglarlo o borrarlo.
      .filter((p) => !soloActivos || p.seleccion.items.length > 0)
  );
}

/**
 * Lee la selección guardada sin confiar en su forma.
 *
 * Es JSON escrito por el panel, pero la base puede tener una fila de una
 * versión anterior o editada a mano. Lo que no tenga la forma esperada cae a
 * vacío en vez de tirar: un paquete roto no puede voltear el simulador entero.
 */
export function leerSeleccion(v: unknown): Seleccion {
  const o = (v ?? {}) as Record<string, unknown>;
  const texto = (x: unknown) => (typeof x === "string" ? x : null);

  const items = Array.isArray(o.items)
    ? o.items.map(texto).filter((x): x is string => x !== null)
    : [];

  const locaciones: Record<string, string> = {};
  if (o.locaciones && typeof o.locaciones === "object") {
    for (const [k, val] of Object.entries(o.locaciones)) {
      const t = texto(val);
      if (t) locaciones[k] = t;
    }
  }

  const coberturas: Record<string, string[]> = {};
  if (o.coberturas && typeof o.coberturas === "object") {
    for (const [k, val] of Object.entries(o.coberturas)) {
      if (Array.isArray(val)) {
        coberturas[k] = val.map(texto).filter((x): x is string => x !== null);
      }
    }
  }

  return { items, locaciones, coberturas };
}
