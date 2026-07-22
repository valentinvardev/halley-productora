"use client";

import { IconoLuna, IconoSol } from "./iconos";

/**
 * Positivo / negativo — el modo oscuro del sistema.
 *
 * Por defecto sigue la preferencia del sistema operativo. Si el usuario elige,
 * su elección manda y queda guardada.
 */

const CLAVE = "halley-tema";

/**
 * Corre antes del primer pintado para que la página no arranque en claro y
 * salte a oscuro. Se inyecta como script inline en el layout.
 */
export const scriptTema = `
try {
  var t = localStorage.getItem("${CLAVE}");
  if (t === "claro" || t === "oscuro") document.documentElement.dataset.tema = t;
} catch (e) {}
`;

function temaActual(): "claro" | "oscuro" {
  const elegido = document.documentElement.dataset.tema;
  if (elegido === "claro" || elegido === "oscuro") return elegido;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "oscuro"
    : "claro";
}

/**
 * El botón muestra el destino, no el estado: en claro se ve la luna.
 *
 * Cuál de los dos íconos se ve lo decide el CSS con las mismas reglas que los
 * colores (`globals.css`), no este componente. Por eso no hace falta estado ni
 * efecto: el ícono correcto ya está pintado antes de que corra el JS, y no hay
 * parpadeo durante la hidratación.
 */
export function BotonTema({ className = "" }: { className?: string }) {
  function alternar() {
    const nuevo = temaActual() === "oscuro" ? "claro" : "oscuro";
    document.documentElement.dataset.tema = nuevo;
    try {
      localStorage.setItem(CLAVE, nuevo);
    } catch {
      // Modo privado sin storage: el cambio vale para esta sesión igual.
    }
  }

  return (
    <button
      onClick={alternar}
      aria-label="Cambiar entre modo claro y oscuro"
      title="Positivo / negativo"
      className={`grid cursor-pointer place-items-center text-gray-45 hover:text-ink ${className}`}
    >
      {/* Los dos apilados en la misma celda: uno entra mientras el otro sale. */}
      <span className="icono-tema icono-sol col-start-1 row-start-1">
        <IconoSol className="h-[15px] w-[15px]" />
      </span>
      <span className="icono-tema icono-luna col-start-1 row-start-1">
        <IconoLuna className="h-[15px] w-[15px]" />
      </span>
    </button>
  );
}
