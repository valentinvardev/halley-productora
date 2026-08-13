"use client";

import { useEffect, useRef, useState } from "react";

import { IconoBillete } from "~/app/_components/iconos";
import { pesos } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * El aviso de cobro: un cartelito abajo a la derecha cuando entra un pago.
 *
 * El panel pregunta cada pocos segundos si entró algo después de la última vez.
 * No hay websocket ni Realtime: para este volumen una consulta indexada cada
 * ocho segundos alcanza de sobra, y no agrega una pieza de infraestructura que
 * después hay que mantener corriendo y vigilando.
 *
 * La marca de "última vez" arranca en el momento en que se abre el panel, no en
 * cero. Eso es a propósito: esto no es una bandeja de entrada, es una campana.
 * Avisa de lo que pasa mientras uno mira; lo que pasó ayer se consulta en
 * Transacciones, que para eso está.
 */

/** Cada cuánto se pregunta. */
const CADA = 8000;

/** Cuánto queda cada cartel antes de irse solo. */
const DURA = 9000;

type Cobro = {
  id: string;
  monto: number;
  alumno: string;
  grupo: string;
};

export function AvisoCobros({ sonido }: { sonido: string }) {
  const [cola, setCola] = useState<Cobro[]>([]);

  /**
   * Desde cuándo se pregunta. Va en una ref y no en estado porque cambiarlo no
   * tiene que redibujar nada, y porque el efecto que lo lee no debe reiniciarse
   * cada vez que avanza.
   */
  const desde = useRef(new Date().toISOString());

  const { data } = api.pago.nuevosDesde.useQuery(
    { desde: desde.current },
    { refetchInterval: CADA, refetchOnWindowFocus: false },
  );

  useEffect(() => {
    if (!data || data.length === 0) return;

    // Se avanza la marca antes de mostrar: si algo falla al dibujar, el pago no
    // vuelve a anunciarse en la próxima vuelta y en la siguiente y en la
    // siguiente.
    desde.current = data[data.length - 1]!.recibidoEn;

    setCola((previos) => [...previos, ...data]);

    if (sonido !== "silencio") {
      const audio = new Audio(`/sonidos/${sonido}.mp3`);
      // El navegador rechaza reproducir sin que el usuario haya interactuado con
      // la página. No es un error que valga la pena mostrar: el cartel se ve
      // igual, que es lo que importa.
      void audio.play().catch(() => undefined);
    }
  }, [data, sonido]);

  // Cada cartel se va solo. El temporizador vive acá y no en el cartel para que
  // desmontarlo no deje uno colgado.
  useEffect(() => {
    if (cola.length === 0) return;
    const t = setTimeout(() => setCola((c) => c.slice(1)), DURA);
    return () => clearTimeout(t);
  }, [cola]);

  if (cola.length === 0) return null;

  return (
    <div
      // `aria-live` para que un lector de pantalla lo cante sin robarle el foco
      // a lo que se esté haciendo.
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(320px,calc(100vw-2rem))] flex-col gap-2"
    >
      {cola.map((c) => (
        <article
          key={c.id}
          className="aviso-cobro pointer-events-auto border border-ink bg-lienzo px-4 py-3 shadow-[0_2px_12px_rgb(0_0_0/0.12)]"
        >
          <div className="flex items-center gap-1.5 font-rotulo text-[11px] uppercase tracking-[0.08em] text-gray-45">
            <IconoBillete className="h-3.5 w-3.5" />
            Pago recibido
          </div>
          <div className="mt-1 font-display text-[21px] leading-none tabular-nums">
            {pesos(c.monto)}
          </div>
          <div className="nota mt-1.5 truncate text-[12px]">
            {c.alumno} · {c.grupo}
          </div>
        </article>
      ))}
    </div>
  );
}
