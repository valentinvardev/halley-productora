import { env } from "~/env";
import { taloMock } from "./mock";
import { taloReal } from "./real";
import type { TaloClient } from "./types";

/** El resto de la app importa sólo esto. */
export const talo: TaloClient = env.TALO_MODE === "real" ? taloReal : taloMock;

export const taloEsMock = env.TALO_MODE !== "real";

export { armarAlias, registrarTransferenciaSimulada } from "./mock";
export type * from "./types";
