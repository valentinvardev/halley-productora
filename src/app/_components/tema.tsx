"use client";

import { useEffect } from "react";

import { IconoLuna, IconoSol } from "./iconos";

/**
 * Positivo / negativo — el modo oscuro del sistema.
 *
 * Por defecto sigue la hora del día: de noche entra en negativo solo. Si el
 * usuario toca el botón, su elección manda y queda guardada — la hora deja de
 * decidir para siempre en ese navegador.
 */

const CLAVE = "halley-tema";

/** A partir de las 19 y hasta las 7 se ve de noche. */
const NOCHE_DESDE = 19;
const NOCHE_HASTA = 7;

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
  var h = new Date().getHours();
  document.documentElement.dataset.tema =
    (g === "claro" || g === "oscuro")
      ? g
      : (h >= ${NOCHE_DESDE} || h < ${NOCHE_HASTA} ? "oscuro" : "claro");
} catch (e) {}
`;

/** Lo que corresponde por la hora, si nadie eligió nada. */
export function temaPorHora(ahora = new Date()): "claro" | "oscuro" {
  const h = ahora.getHours();
  return h >= NOCHE_DESDE || h < NOCHE_HASTA ? "oscuro" : "claro";
}

function eligioElUsuario() {
  try {
    const g = localStorage.getItem(CLAVE);
    return g === "claro" || g === "oscuro";
  } catch {
    return false;
  }
}

function temaActual(): "claro" | "oscuro" {
  const puesto = document.documentElement.dataset.tema;
  if (puesto === "claro" || puesto === "oscuro") return puesto;
  return temaPorHora();
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
  // Una pestaña abierta desde la tarde hasta la noche tiene que oscurecerse
  // sola al cruzar la hora. Sólo mientras el usuario no haya elegido: el
  // momento en que toca el botón, la hora deja de opinar.
  useEffect(() => {
    if (eligioElUsuario()) return;

    const reloj = setInterval(() => {
      if (eligioElUsuario()) return;
      const toca = temaPorHora();
      if (document.documentElement.dataset.tema !== toca) {
        document.documentElement.dataset.tema = toca;
      }
    }, 60_000);

    return () => clearInterval(reloj);
  }, []);

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
