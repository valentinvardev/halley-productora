/**
 * Contrato con Mercado Pago (Checkout Pro).
 *
 * A diferencia de Talo —que le da a cada alumno un CVU fijo al que la familia
 * transfiere—, Checkout Pro es por pago: se crea una *preferencia* con el monto
 * exacto, se redirige a la familia a la pantalla de Mercado Pago, y cuando paga,
 * MP avisa por webhook. La confirmación nunca se cree del webhook: se vuelve a
 * pedir el pago a la API de MP con el token del socio, que es la única fuente de
 * verdad.
 *
 * Cada socio cobra en SU cuenta, así que el token no es global como el de Talo:
 * viaja como parámetro en cada llamada, sacado de la CuentaPago del grupo.
 */

export interface CrearPreferenciaInput {
  /** Monto total a cobrar, en pesos. */
  monto: number;
  /** Lo que la familia ve como concepto en la pantalla de MP. */
  descripcion: string;
  /** Nuestra referencia para reconciliar en el webhook: el id del alumno. */
  referenciaExterna: string;
  /** A dónde vuelve la familia después de pagar (éxito, error o pendiente). */
  urlRetorno: string;
  /** A dónde MP notifica el pago. Lleva embebida la cuenta que cobra. */
  urlWebhook: string;
  /** Email de la familia, para prellenar. Opcional. */
  emailPagador?: string;
}

export interface Preferencia {
  preferenciaId: string;
  /** URL de Checkout Pro a la que se redirige a la familia. */
  urlPago: string;
}

export type EstadoPagoMP = "aprobado" | "pendiente" | "rechazado";

export interface PagoMP {
  pagoId: string;
  estado: EstadoPagoMP;
  /** Monto acreditado, en pesos. */
  monto: number;
  /** Lo que mandamos como referenciaExterna: el id del alumno. */
  referenciaExterna: string | null;
  creadoEn: Date;
}

export interface MercadoPagoClient {
  crearPreferencia(
    accessToken: string,
    input: CrearPreferenciaInput,
  ): Promise<Preferencia>;
  /** Confirma monto y estado después del webhook. `accessToken` es el del socio. */
  obtenerPago(accessToken: string, pagoId: string): Promise<PagoMP | null>;
}
