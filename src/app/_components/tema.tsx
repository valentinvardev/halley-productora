"use client";

import { IconoLuna, IconoSol } from "./iconos";

/**
 * Positivo / negativo — el modo claro, para quien lo pida.
 *
 * El oscuro no se enciende desde acá: es la paleta base del CSS. Este archivo
 * sólo se ocupa del caso contrario, que alguien haya elegido el claro con el
 * botón, y de recordarlo en ese navegador.
 *
 * Antes lo decidía la hora: negativo de 19 a 7, positivo el resto del día, y una
 * pestaña abierta desde la tarde se oscurecía sola al cruzar las siete. Era
 * lindo y se fue igual, porque la web es una pieza de marca antes que una
 * herramienta: el trabajo de Halley son fotos y videos, y sobre papel oscuro se
 * ven como en una sala y no como en una hoja. Que la mitad de las visitas vieran
 * la versión clara era dejar esa decisión en manos del reloj de cada uno.
 */

const CLAVE = "halley-tema";

/**
 * Lo que ve quien todavía no eligió nada.
 *
 * Quien lo pinta es el CSS, no este archivo. Acá se repite para que el primer
 * clic del botón sepa desde dónde está saliendo: sin esto habría que leerle el
 * tema a la hoja de estilos, que es mucho preguntar para alternar dos valores.
 * Si algún día la base del CSS cambia, esta constante cambia con ella.
 */
const POR_DEFECTO = "oscuro";

/**
 * Aplica la elección guardada antes del primer pintado. Se inyecta como script
 * inline en el layout.
 *
 * Escribe el atributo sólo si hay algo guardado. Antes lo escribía siempre, y
 * eso quería decir que el tema por defecto lo ponía el JavaScript: el HTML del
 * servidor salía sin atributo, el CSS lo pintaba claro y el script lo corregía a
 * oscuro un instante después. Ahora el oscuro ya viene en el CSS, así que no hay
 * nada que corregir y no hay instante: la página nace en el tema que va, incluso
 * si el script no llega a correr.
 *
 * Decide acá y no en un efecto porque un efecto corre después de pintar: quien
 * eligió el claro vería el destello del oscuro antes de su propia elección.
 */
export const scriptTema = `
try {
  var g = localStorage.getItem("${CLAVE}");
  if (g === "claro" || g === "oscuro") document.documentElement.dataset.tema = g;
} catch (e) {}
`;

function temaActual(): "claro" | "oscuro" {
  const puesto = document.documentElement.dataset.tema;
  if (puesto === "claro" || puesto === "oscuro") return puesto;
  return POR_DEFECTO;
}

/**
 * El botón muestra el destino, no el estado: en oscuro se ve el sol.
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
