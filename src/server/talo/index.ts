import { env } from "~/env";
import { taloMock } from "./mock";
import { taloReal } from "./real";
import type { TaloClient } from "./types";

/** El resto de la app importa sólo esto. */
export const talo: TaloClient = env.TALO_MODE === "real" ? taloReal : taloMock;

export const taloEsMock = env.TALO_MODE !== "real";

// El mock se exporta además de estar detrás de `talo`: un grupo marcado de
// prueba lo usa aunque el sistema entero esté apuntando al proveedor real.
export { armarAlias, registrarTransferenciaSimulada, taloMock } from "./mock";
export { credencialesDeAlumno, credencialesDeGrupo } from "./credenciales";
export type * from "./types";
