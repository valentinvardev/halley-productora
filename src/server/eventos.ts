import "server-only";

import { db } from "./db";

/**
 * La bitácora del dinero.
 *
 * Registra cada paso alrededor de un cobro: el que se inició, el aviso que
 * llegó, cómo terminó. Es lo que convierte "no le entró el pago a una familia"
 * de un misterio en algo que se mira en pantalla.
 *
 * Nada de esto puede tumbar un cobro: si escribir en la bitácora falla, se
 * anota en la consola y se sigue. Un problema registrando no puede convertirse
 * en un problema cobrando.
 */

export type TipoEvento =
  | "cobro-iniciado"
  | "aviso-recibido"
  | "pago-registrado"
  | "aviso-rechazado";

export type DatosEvento = {
  proveedor: "TALO" | "MERCADOPAGO";
  tipo: TipoEvento;
  resultado?: string;
  /** Marca los que hay que mirar: sale destacado en la pantalla. */
  falla?: boolean;
  refPago?: string | null;
  monto?: number | null;
  alumnoId?: string | null;
  alumnoNombre?: string | null;
  grupoId?: string | null;
  grupoNombre?: string | null;
  cuentaNombre?: string | null;
  detalle?: string | null;
};

export async function registrarEvento(datos: DatosEvento) {
  try {
    await db.eventoPago.create({
      data: {
        proveedor: datos.proveedor,
        tipo: datos.tipo,
        resultado: datos.resultado ?? null,
        falla: datos.falla ?? false,
        refPago: datos.refPago ?? null,
        monto: datos.monto ?? null,
        alumnoId: datos.alumnoId ?? null,
        alumnoNombre: datos.alumnoNombre ?? null,
        grupoId: datos.grupoId ?? null,
        grupoNombre: datos.grupoNombre ?? null,
        cuentaNombre: datos.cuentaNombre ?? null,
        detalle: datos.detalle?.slice(0, 2000) ?? null,
      },
    });
  } catch (error) {
    console.error("[eventos] no se pudo registrar:", error);
  }
}
