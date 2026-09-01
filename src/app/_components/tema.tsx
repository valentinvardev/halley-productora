"use client";

import { IconoLuna, IconoSol } from "./iconos";

/**
 * Positivo / negativo — el modo oscuro del sistema.
 *
 * Arranca en oscuro y ahí se queda hasta que alguien diga otra cosa. Si el
 * usuario toca el botón, su elección manda y queda guardada en ese navegador.
 *
 * Antes lo decidía la hora: negativo de 19 a 7, positivo el resto del día, y una
 * pestaña abierta desde la tarde se oscurecía sola al cruzar las siete. Era
 * lindo y se fue igual, porque la web es una pieza de marca antes que una
 * herramienta: el trabajo de Halley son fotos y videos, y sobre papel oscuro se
 * ven como en una sala y no como en una hoja. Que la mitad de las visitas vieran
 * la versión clara era dejar esa decisión en manos del reloj de cada uno.
 */

const CLAVE = "halley-tema";

/** Lo que ve quien todavía no eligió nada. */
const POR_DEFECTO = "oscuro";

/**
 * Corre antes del primer pintado para que la página no arranque en claro y
 * salte a oscuro. Se inyecta como script inline en el layout.
 *
 * Decide acá y no en un efecto porque un efecto corre después de pintar: se
 * vería el destello del tema equivocado.
 */
export const scriptTema = `
try {
  var g = localStorage.getItem("${CLAVE}");
  document.documentElement.dataset.tema =
    (g === "claro" || g === "oscuro") ? g : "${POR_DEFECTO}";
} catch (e) {}
`;


function temaActual(): "claro" | "oscuro" {
  const puesto = document.documentElement.dataset.tema;
  if (puesto === "claro" || puesto === "oscuro") return puesto;
  return POR_DEFECTO;
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
  // Acá vivía un reloj que revisaba la hora cada minuto para oscurecer una
  // pestaña abierta desde la tarde. Con el tema fijo no hay nada que vigilar:
  // el default no cambia solo y la elección del usuario tampoco.

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
