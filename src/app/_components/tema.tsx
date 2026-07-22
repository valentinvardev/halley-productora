"use client";

import { useEffect, useState } from "react";

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

export function BotonTema({ className = "" }: { className?: string }) {
  const [tema, setTema] = useState<"claro" | "oscuro" | null>(null);

  // Recién en el cliente sabemos cuál está activo: el servidor no conoce ni el
  // localStorage ni la preferencia del sistema.
  useEffect(() => setTema(temaActual()), []);

  function alternar() {
    const nuevo = temaActual() === "oscuro" ? "claro" : "oscuro";
    document.documentElement.dataset.tema = nuevo;
    try {
      localStorage.setItem(CLAVE, nuevo);
    } catch {
      // Modo privado sin storage: el cambio vale para esta sesión igual.
    }
    setTema(nuevo);
  }

  return (
    <button
      onClick={alternar}
      aria-label={
        tema === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
      }
      title="Positivo / negativo"
      className={`cursor-pointer font-rotulo text-[13px] uppercase tracking-[0.06em] text-gray-45 hover:text-ink ${className}`}
    >
      {/* Hasta que el efecto corra mostramos un guion, para no parpadear con
          el valor equivocado durante la hidratación. */}
      {tema === null ? "—" : tema === "oscuro" ? "Positivo" : "Negativo"}
    </button>
  );
}
