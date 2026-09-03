"use client";

import { useEffect, useState } from "react";

import { api } from "~/trpc/react";

/**
 * Muestra de trabajos: el costado de las pantallas de acceso.
 *
 * Un mosaico de cubos que giran para cambiar de foto, con las fotos reales de
 * la vitrina. Antes eran diapositivas con un cuadro de película dibujado como
 * marcador, esperando que alguien dejara archivos en una carpeta; nunca pasó, y
 * el costado se veía en blanco. Ahora se alimenta solo de lo que Halley sube.
 *
 * Sólo existe en pantalla grande: en el teléfono el marco lo esconde.
 */

/**
 * Cuántos cubos y cada cuánto gira uno.
 *
 * Nueve en tres por tres llena el costado sin que cada foto quede chica. Gira
 * uno por vez y no todos juntos: nueve cubos girando a la vez es una máquina
 * tragamonedas, uno cada dos segundos es una pared que respira.
 */
const CUBOS = 9;
const CARAS = 4;
const CADA_MS = 2200;

export function Muestra() {
  const fotos = api.contenido.muestraAcceso.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  /**
   * Cuántos cuartos de vuelta lleva cada cubo. Un número que sólo sube: la cara
   * de adelante es `giros % 4`, y girar siempre para el mismo lado evita que el
   * cubo vuelva sobre sus pasos.
   */
  const [giros, setGiros] = useState<number[]>(() => Array(CUBOS).fill(0));
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    // Quien pidió menos movimiento se queda con el mosaico quieto.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (pausado) return;
    let cual = Math.floor(Math.random() * CUBOS);
    const id = setInterval(() => {
      // El siguiente cubo, nunca el mismo dos veces seguidas.
      cual = (cual + 1 + Math.floor(Math.random() * (CUBOS - 1))) % CUBOS;
      const objetivo = cual;
      setGiros((g) => g.map((v, i) => (i === objetivo ? v + 1 : v)));
    }, CADA_MS);
    return () => clearInterval(id);
  }, [pausado]);

  const lista = fotos.data ?? [];

  return (
    <div
      className="grid h-full w-full grid-cols-3 grid-rows-3 gap-px overflow-hidden bg-ink"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      {Array.from({ length: CUBOS }, (_, i) => (
        <Cubo key={i} indice={i} giros={giros[i] ?? 0} fotos={lista} />
      ))}
    </div>
  );
}

/**
 * Un cubo con una foto en cada una de sus cuatro caras laterales.
 *
 * Las caras se reparten las fotos de la lista salteando de a nueve, así dos
 * cubos vecinos no muestran la misma. Cuando el cubo gira, la cara que entra
 * ya tiene su foto puesta desde antes: no hay carga a la vista.
 *
 * Sin fotos todavía (o sin ninguna subida) cada cara es un cuadro de película,
 * el mismo marcador de siempre. Así la pantalla no se ve vacía ni un segundo.
 */
function Cubo({
  indice,
  giros,
  fotos,
}: {
  indice: number;
  giros: number;
  fotos: { id: string; url: string }[];
}) {
  return (
    <div className="cubo relative bg-paper-dimmer">
      <div
        className="cubo-caras absolute inset-0"
        style={{
          // Retraído la mitad del ancho: así la cara de adelante queda justo en
          // el plano de la celda. Sin esto está más cerca del ojo que la celda,
          // se dibuja más grande por la perspectiva y pisa a las vecinas.
          transform: `translateZ(calc(-1 * var(--mitad))) rotateY(${giros * -90}deg)`,
        }}
      >
        {Array.from({ length: CARAS }, (_, cara) => {
          // La foto de esta cara: fija, no depende del giro. Lo que cambia con
          // el giro es qué cara mira al frente.
          const foto = fotos.length
            ? fotos[(indice + cara * CUBOS) % fotos.length]
            : null;
          return (
            <div
              key={cara}
              className="cara absolute inset-0 overflow-hidden"
              style={{
                transform: `rotateY(${cara * 90}deg) translateZ(var(--mitad))`,
              }}
            >
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={foto.url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <CuadroDePelicula
                  cuadro={
                    String(indice * CARAS + cara + 1).padStart(2, "0") + "A"
                  }
                  indice={indice + cara}
                />
              )}
            </div>
          );
        })}
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
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.18]"
        aria-hidden
      >
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
