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

/**
 * El evento del navegador con el que Ajustes pide una muestra.
 *
 * Va por `window` y no por contexto de React porque los dos lados viven en
 * ramas distintas del árbol: el cartel cuelga del layout del panel y el botón
 * está adentro de una página. Levantar un proveedor hasta el layout para que
 * dos componentes que no se conocen se pasen un aviso suelto es más plomería de
 * la que el problema pide.
 *
 * Y así la muestra es literalmente el aviso de verdad, en el mismo lugar y con
 * el mismo sonido. Un preview que se dibuja aparte termina siendo un dibujo de
 * lo que uno cree que hace el sistema.
 */
const PRUEBA = "halley:cobro-de-prueba";

export function probarAvisoCobro() {
  window.dispatchEvent(new Event(PRUEBA));
}

/** El pago inventado de la muestra. Se ve igual, pero dice que es de mentira. */
const MUESTRA = {
  monto: 45000,
  alumno: "Lucía Bustos",
  grupo: "Egresados 2027 — Colegio San Martín",
};

function sonar(sonido: string) {
  if (sonido === "silencio") return;
  // El navegador rechaza reproducir sin que el usuario haya interactuado con la
  // página. No es un error que valga la pena mostrar: el cartel se ve igual,
  // que es lo que importa.
  void new Audio(`/sonidos/${sonido}.mp3`).play().catch(() => undefined);
}

type Cobro = {
  id: string;
  monto: number;
  alumno: string;
  grupo: string;
  /** La muestra de Ajustes. Nunca puede parecer un cobro de verdad. */
  prueba?: boolean;
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
    sonar(sonido);
  }, [data, sonido]);

  // La muestra que dispara Ajustes: el mismo cartel, en el mismo rincón, con el
  // sonido que está elegido en ese momento.
  useEffect(() => {
    function alProbar() {
      setCola((c) => [
        ...c,
        { id: `prueba-${Date.now()}`, ...MUESTRA, prueba: true },
      ]);
      sonar(sonido);
    }

    window.addEventListener(PRUEBA, alProbar);
    return () => window.removeEventListener(PRUEBA, alProbar);
  }, [sonido]);

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
      className="pointer-events-none fixed top-4 right-4 z-50 flex w-[min(320px,calc(100vw-2rem))] flex-col gap-2"
    >
      {cola.map((c) => (
        <article
          key={c.id}
          className="aviso-cobro pointer-events-auto border border-ink bg-lienzo px-4 py-3 shadow-[0_2px_12px_rgb(0_0_0/0.12)]"
        >
          <div className="flex items-center gap-1.5 font-rotulo text-[11px] uppercase tracking-[0.08em] text-gray-45">
            <IconoBillete className="h-3.5 w-3.5" />
            Pago recibido
            {/* Un cobro de mentira que se ve igual que uno de verdad es una
                trampa esperando: la muestra lo dice en la cara. */}
            {c.prueba && (
              <span className="ml-auto border border-gray-45 px-1.5 py-0.5 text-[9.5px] tracking-[0.08em]">
                Prueba
              </span>
            )}
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
