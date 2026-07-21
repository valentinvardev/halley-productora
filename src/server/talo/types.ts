/**
 * Contrato con Talo. Toda la app habla contra esta interfaz y nunca contra
 * `fetch` directamente: para la demo corre la implementación mock y el día que
 * lleguen las credenciales se cambia `TALO_MODE` a "real" sin tocar el resto.
 */

export interface TaloCustomer {
  customerId: string;
  cvu: string;
  alias: string;
}

export interface CrearCustomerInput {
  /** Nuestro id interno de Padre — Talo lo acepta como customer_id. */
  customerId: string;
  nombre: string;
  email: string;
  /** Alias legible que le pedimos a Talo (halley.colegio.nombre). */
  aliasSugerido: string;
  /** URL a la que Talo notifica los pagos de este customer. */
  webhookUrl: string;
}

export interface TaloTransaction {
  transactionId: string;
  customerId: string;
  /** Monto acreditado, en pesos. */
  monto: number;
  moneda: "ARS";
  creadoEn: Date;
}

export interface TaloClient {
  crearCustomer(input: CrearCustomerInput): Promise<TaloCustomer>;
  /** Confirmación de monto y fecha después de recibir el webhook. */
  obtenerTransaccion(
    customerId: string,
    transactionId: string,
  ): Promise<TaloTransaction | null>;
}

/** Payload que Talo manda al webhook. */
export interface TaloWebhookPayload {
  message: string;
  transactionId: string;
  customerId: string;
}
