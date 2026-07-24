import { env } from "~/env";
import { mercadoPagoMock } from "./mock";
import { mercadoPagoReal } from "./real";
import type { MercadoPagoClient } from "./types";

/** El resto de la app importa sólo esto. */
export const mercadoPago: MercadoPagoClient =
  env.MP_MODE === "real" ? mercadoPagoReal : mercadoPagoMock;

export const mpEsMock = env.MP_MODE !== "real";

export { aprobarPagoMockMp } from "./mock";
export type * from "./types";
