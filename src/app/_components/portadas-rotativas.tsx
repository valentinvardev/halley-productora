"use client";

import { useEffect, useState } from "react";

export type PiezaPortada = {
  id: string;
  url: string;
  tipo: "imagen" | "video";
};

/** Cuántas portadas admite una categoría, y cada cuánto rota. */
export const MAX_PORTADAS = 4;
const INTERVALO = 5200;

/**
 * Las portadas de una categoría, alternándose.
 *
 * Cada una va en dos capas —una copia difuminada que llena el panel y la foto
 * entera encima— y el conjunto se cruza por opacidad, así el cambio es un
 * fundido y no un salto. Con una sola portada no hay temporizador: no hay entre
 * qué alternar.
 *
 * Con `prefers-reduced-motion` se queda quieta en la primera. Una imagen que
 * cambia sola es justamente lo que esa preferencia pide evitar.
 */
export function PortadasRotativas({ piezas }: { piezas: PiezaPortada[] }) {
  const [activa, setActiva] = useState(0);

  useEffect(() => {
    if (piezas.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const reloj = setInterval(
      () => setActiva((i) => (i + 1) % piezas.length),
      INTERVALO,
    );
    return () => clearInterval(reloj);
  }, [piezas.length]);

  return (
    <>
      {piezas.map((p, i) => (
        <div
          key={p.id}
          aria-hidden="true"
          className="absolute inset-0 transition-opacity duration-[1200ms] ease-in-out"
          style={{ opacity: i === activa ? 1 : 0 }}
        >
          {p.tipo === "video" ? (
            <>
              <video
                src={p.url}
                muted
                loop
                autoPlay
                playsInline
                className="fondo-servicio absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
              />
              <video
                src={p.url}
                muted
                loop
                autoPlay
                playsInline
                className="absolute inset-0 h-full w-full object-contain"
              />
            </>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                className="fondo-servicio absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
              />
            </>
          )}
        </div>
      ))}

      {/* Las marquitas de abajo: cuántas portadas hay y en cuál va. */}
      {piezas.length > 1 && (
        <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {piezas.map((p, i) => (
            <span
              key={p.id}
              className={`h-[3px] w-6 transition-colors duration-500 ${
                i === activa ? "bg-white" : "bg-white/35"
              }`}
            />
          ))}
        </div>
      )}
    </>
  );
}
