"use client";

import { useEffect, useState } from "react";

/**
 * Papelitos, una sola vez.
 *
 * Son rectángulos finos —recortes de papel, no globitos de colores— porque el
 * sistema es una hoja de contacto y un confeti de fiesta infantil no pertenece
 * acá. La gracia es que se note que pasó algo bueno, no tapar la pantalla.
 *
 * Se dibujan con divs y una animación de CSS en vez de un canvas: son treinta
 * elementos que viven dos segundos, y traer una librería de partículas para eso
 * sería más peso que el resto de la página junta.
 *
 * Con `prefers-reduced-motion` no cae nada: quien pidió menos movimiento no
 * quiere justamente esto.
 */

const CUANTOS = 30;
const COLORES = [
  "var(--color-ink)",
  "var(--color-gray-45)",
  "var(--color-marca)",
];

export function Confeti() {
  const [papeles, setPapeles] = useState<
    { izq: number; demora: number; giro: number; color: string; alto: number }[]
  >([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // El azar se calcula en el cliente y después del primer pintado: si saliera
    // del render, el servidor y el navegador dibujarían papeles distintos.
    setPapeles(
      Array.from({ length: CUANTOS }, () => ({
        izq: Math.random() * 100,
        demora: Math.random() * 0.5,
        giro: Math.random() * 360,
        color: COLORES[Math.floor(Math.random() * COLORES.length)]!,
        alto: 7 + Math.random() * 7,
      })),
    );
  }, []);

  if (papeles.length === 0) return null;

  return (
    <div className="confeti pointer-events-none absolute inset-0 overflow-hidden">
      {papeles.map((p, i) => (
        <span
          key={i}
          className="confeti-papel"
          style={{
            left: `${p.izq}%`,
            height: `${p.alto}px`,
            background: p.color,
            animationDelay: `${p.demora}s`,
            ["--giro" as string]: `${p.giro}deg`,
          }}
        />
      ))}
    </div>
  );
}
