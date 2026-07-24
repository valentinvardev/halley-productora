"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reproductor de video propio.
 *
 * Los controles nativos los dibuja cada navegador a su manera y rompen el tono
 * del sitio; estos son de la marca: barra recta, sin relieve, en blanco sobre el
 * video. Lo mínimo que un visor necesita —play, tiempo, barra para buscar,
 * silencio y pantalla completa— y nada más.
 *
 * El estado sale del elemento `<video>`, no de React: la fuente de verdad es el
 * reproductor, así que si el video se pausa solo o termina, la UI lo refleja.
 */

function reloj(seg: number) {
  if (!Number.isFinite(seg)) return "0:00";
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Reproductor({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [andando, setAndando] = useState(false);
  const [mudo, setMudo] = useState(false);
  const [t, setT] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;

    const sincronizar = () => {
      setAndando(!v.paused && !v.ended);
      setT(v.currentTime);
      setTotal(v.duration);
      setMudo(v.muted);
    };

    v.addEventListener("timeupdate", sincronizar);
    v.addEventListener("play", sincronizar);
    v.addEventListener("pause", sincronizar);
    v.addEventListener("loadedmetadata", sincronizar);
    v.addEventListener("volumechange", sincronizar);
    return () => {
      v.removeEventListener("timeupdate", sincronizar);
      v.removeEventListener("play", sincronizar);
      v.removeEventListener("pause", sincronizar);
      v.removeEventListener("loadedmetadata", sincronizar);
      v.removeEventListener("volumechange", sincronizar);
    };
  }, [src]);

  // Espacio para play/pausa, como en cualquier reproductor.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      const v = ref.current;
      if (!v) return;
      void (v.paused ? v.play() : v.pause());
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, []);

  const alternar = () => {
    const v = ref.current;
    if (!v) return;
    void (v.paused ? v.play() : v.pause());
  };

  const avance = total > 0 ? (t / total) * 100 : 0;

  return (
    <div
      className="relative max-h-[88vh] w-full max-w-[1100px]"
      onClick={(e) => e.stopPropagation()}
    >
      <video
        ref={ref}
        src={src}
        autoPlay
        playsInline
        onClick={alternar}
        className="max-h-[80vh] w-full cursor-pointer bg-black object-contain"
      />

      {/* Controles: barra recta, sin relieve, en la línea de la marca. */}
      <div className="mt-3 flex items-center gap-4 border border-white/25 bg-black/60 px-4 py-3">
        <button
          type="button"
          onClick={alternar}
          aria-label={andando ? "Pausar" : "Reproducir"}
          className="shrink-0 text-white/80 hover:text-white"
        >
          {andando ? (
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
              <rect x="3.5" y="2.5" width="3.2" height="11" fill="currentColor" />
              <rect x="9.3" y="2.5" width="3.2" height="11" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
              <path d="M4 2.5 L13 8 L4 13.5 Z" fill="currentColor" />
            </svg>
          )}
        </button>

        <span className="shrink-0 font-mono text-[11px] text-white/70 tabular-nums">
          {reloj(t)}
        </span>

        {/* La barra: el input va invisible encima para no pelear con el estilo. */}
        <div className="relative flex-1">
          <div className="h-[3px] w-full bg-white/25">
            <div
              className="h-full bg-white"
              style={{ width: `${avance}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={total || 0}
            step={0.1}
            value={t}
            aria-label="Buscar en el video"
            onChange={(e) => {
              const v = ref.current;
              if (v) v.currentTime = Number(e.target.value);
            }}
            className="absolute inset-x-0 -top-2 h-6 w-full cursor-pointer opacity-0"
          />
        </div>

        <span className="shrink-0 font-mono text-[11px] text-white/70 tabular-nums">
          {reloj(total)}
        </span>

        <button
          type="button"
          onClick={() => {
            const v = ref.current;
            if (v) v.muted = !v.muted;
          }}
          aria-label={mudo ? "Activar sonido" : "Silenciar"}
          className="shrink-0 text-white/80 hover:text-white"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true">
            <path d="M3 6 L6 6 L9.5 3 L9.5 13 L6 10 L3 10 Z" strokeLinejoin="round" />
            {mudo ? (
              <path d="M11.5 6 L14.5 10 M14.5 6 L11.5 10" strokeLinecap="round" />
            ) : (
              <path d="M11.6 5.8 A3.4 3.4 0 0 1 11.6 10.2" strokeLinecap="round" />
            )}
          </svg>
        </button>

        <button
          type="button"
          onClick={() => void ref.current?.requestFullscreen?.()}
          aria-label="Pantalla completa"
          className="shrink-0 text-white/80 hover:text-white"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true">
            <path d="M2 6 L2 2 L6 2 M10 2 L14 2 L14 6 M14 10 L14 14 L10 14 M6 14 L2 14 L2 10" />
          </svg>
        </button>
      </div>
    </div>
  );
}
