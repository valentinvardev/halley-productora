"use client";

import { useEffect, useState } from "react";

/**
 * Muestra de trabajos: las diapositivas del costado de las pantallas de acceso.
 *
 * Mientras no estén las fotos reales, cada diapositiva se dibuja como un cuadro
 * de película —grano, perforaciones de 35 mm, número de cuadro—, que es el mismo
 * lenguaje de la hoja de contacto. Para poner las fotos de Halley: dejar los
 * archivos en `public/muestras/` y completar `src` acá abajo. No hay que tocar
 * nada más.
 */

type Diapositiva = {
  cuadro: string;
  titulo: string;
  pie: string;
  /** Ej. "/muestras/egresados-01.jpg". Sin esto se dibuja el marcador. */
  src?: string;
};

const DIAPOSITIVAS: Diapositiva[] = [
  {
    cuadro: "01A",
    titulo: "Egresados 2027",
    pie: "Colegio San Martín — Córdoba",
  },
  { cuadro: "07B", titulo: "Bodas", pie: "Estancia La Paz — 2026" },
  { cuadro: "12A", titulo: "Quince años", pie: "Sesión de estudio" },
  { cuadro: "03C", titulo: "Comuniones", pie: "Parroquia del Carmen" },
  { cuadro: "21B", titulo: "Egresados 2026", pie: "Instituto Belgrano" },
];

const SEGUNDOS = 5;

export function Muestra() {
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    // Quien pidió menos movimiento se queda con una sola imagen fija.
    const menosMovimiento = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (menosMovimiento || pausado) return;

    const id = setInterval(
      () => setActual((i) => (i + 1) % DIAPOSITIVAS.length),
      SEGUNDOS * 1000,
    );
    return () => clearInterval(id);
  }, [pausado]);

  const diapositiva = DIAPOSITIVAS[actual]!;

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-paper-dimmer"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      {DIAPOSITIVAS.map((d, i) => (
        <div
          key={d.cuadro}
          aria-hidden={i !== actual}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === actual ? "opacity-100" : "opacity-0"
          }`}
        >
          {d.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={d.src}
              alt={`${d.titulo} — ${d.pie}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <CuadroDePelicula cuadro={d.cuadro} indice={i} />
          )}
        </div>
      ))}

      {/* Pie: qué se está viendo */}
      <div className="absolute right-0 bottom-0 left-0 flex items-end justify-between gap-6 p-8">
        <div>
          <div className="font-display text-[26px] leading-none text-paper drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]">
            {diapositiva.titulo}
          </div>
          <div className="mt-2 font-rotulo text-[12.5px] uppercase tracking-[0.12em] text-paper/80 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
            {diapositiva.pie}
          </div>
        </div>

        {/* Contador, como el visor de una cámara */}
        <div className="flex items-center gap-2">
          {DIAPOSITIVAS.map((d, i) => (
            <button
              key={d.cuadro}
              onClick={() => setActual(i)}
              aria-label={`Ver ${d.titulo}`}
              className={`h-1.5 w-6 border border-paper/70 transition-colors ${
                i === actual ? "bg-paper" : "bg-transparent hover:bg-paper/40"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Marcador de posición: un cuadro de negativo. No pretende pasar por una foto —
 * se lee como lo que es, un lugar reservado para una.
 */
function CuadroDePelicula({
  cuadro,
  indice,
}: {
  cuadro: string;
  indice: number;
}) {
  // Cada cuadro con su propio encuadre, para que la secuencia no se repita.
  const angulos = [135, 200, 65, 320, 25];
  const angulo = angulos[indice % angulos.length];

  return (
    <div className="relative h-full w-full">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(${angulo}deg, #d7d5ca 0%, #a8a69c 45%, #4a4a45 100%)`,
        }}
      />

      {/* Grano de película */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.18]" aria-hidden>
        <filter id={`grano-${indice}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grano-${indice})`} />
      </svg>

      {/* Perforaciones de 35 mm, arriba y abajo */}
      {["top-0", "bottom-0"].map((borde) => (
        <div
          key={borde}
          className={`absolute ${borde} right-0 left-0 flex h-7 items-center justify-around bg-ink/85 px-2`}
        >
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="h-3 w-4 bg-paper/85" />
          ))}
        </div>
      ))}

      <div className="absolute top-10 left-6 font-mono text-[11px] tracking-[0.14em] text-paper/85">
        {cuadro}
      </div>
    </div>
  );
}
