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

/**
 * Cuánto queda cada cartel antes de irse solo.
 *
 * Cada uno lleva su propio reloj. Antes había uno solo que sacaba al primero
 * de la fila y recién ahí arrancaba a contar para el siguiente, así que
 * cinco pagos seguidos tardaban cinco veces esto en irse, y uno nuevo
 * reiniciaba la cuenta del que ya estaba. Con el reloj por cartel, cada uno
 * se va a los siete segundos de haber llegado, pase lo que pase alrededor.
 */
const DURA = 7000;

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

type DetallePrueba = { sonido?: string; sonidoKey?: string };

/**
 * Pide una muestra con el sonido que se está eligiendo, no con el guardado.
 *
 * Antes el evento iba pelado y el cartel sonaba con lo que tenía puesto el
 * layout, que es lo que estaba guardado al abrir el panel. Cambiar el
 * desplegable y tocar "probar" sonaba siempre igual, y parecía que los
 * sonidos eran el mismo. Eran distintos; lo que no cambiaba era cuál se
 * probaba.
 */
export function probarAvisoCobro(detalle: DetallePrueba = {}) {
  window.dispatchEvent(
    new CustomEvent<DetallePrueba>(PRUEBA, { detail: detalle }),
  );
}

/** El pago inventado de la muestra. Se ve igual, pero dice que es de mentira. */
const MUESTRA = {
  monto: 45000,
  alumno: "Lucía Bustos",
  grupo: "Egresados 2027 — Colegio San Martín",
};

function sonar(sonido: string, sonidoKey?: string) {
  if (sonido === "silencio") return;
  // El propio se sirve por su ruta, que redirige al archivo en S3. El `v`
  // cambia con el archivo, para que el navegador no reutilice el anterior.
  const src =
    sonido === "personalizado"
      ? sonidoKey
        ? `/api/sonido?v=${encodeURIComponent(sonidoKey)}`
        : `/sonidos/campana.mp3`
      : `/sonidos/${sonido}.mp3`;
  // El navegador rechaza reproducir sin que el usuario haya interactuado con la
  // página. No es un error que valga la pena mostrar: el cartel se ve igual,
  // que es lo que importa.
  void new Audio(src).play().catch(() => undefined);
}

type Cobro = {
  id: string;
  monto: number;
  alumno: string;
  grupo: string;
  /** La muestra de Ajustes. Nunca puede parecer un cobro de verdad. */
  prueba?: boolean;
  /** Cuándo se va solo, en milisegundos de reloj. */
  hasta: number;
};

export function AvisoCobros({
  sonido,
  sonidoKey,
}: {
  sonido: string;
  sonidoKey?: string;
}) {
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

    const hasta = Date.now() + DURA;
    setCola((previos) => [...previos, ...data.map((d) => ({ ...d, hasta }))]);
    sonar(sonido, sonidoKey);
  }, [data, sonido, sonidoKey]);

  // La muestra que dispara Ajustes: el mismo cartel, en el mismo rincón, con el
  // sonido que está elegido en ese momento.
  useEffect(() => {
    function alProbar(e: Event) {
      const detalle = (e as CustomEvent<DetallePrueba>).detail ?? {};
      setCola((c) => [
        ...c,
        {
          id: `prueba-${Date.now()}`,
          ...MUESTRA,
          prueba: true,
          hasta: Date.now() + DURA,
        },
      ]);
      sonar(detalle.sonido ?? sonido, detalle.sonidoKey ?? sonidoKey);
    }

    window.addEventListener(PRUEBA, alProbar);
    return () => window.removeEventListener(PRUEBA, alProbar);
  }, [sonido, sonidoKey]);

  // Cada cartel se va solo, con su propio reloj. Los temporizadores viven acá
  // y no en el cartel para que desmontar el componente no deje ninguno
  // colgado; se rearman con el tiempo que le queda a cada uno.
  useEffect(() => {
    if (cola.length === 0) return;
    const ahora = Date.now();
    const relojes = cola.map((c) =>
      setTimeout(
        () => setCola((cs) => cs.filter((x) => x.id !== c.id)),
        Math.max(0, c.hasta - ahora),
      ),
    );
    return () => relojes.forEach(clearTimeout);
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
          // Tocarlo lo saca: quien ya lo leyó no tiene por qué esperarlo.
          onClick={() => setCola((cs) => cs.filter((x) => x.id !== c.id))}
          title="Cerrar"
          className="aviso-cobro pointer-events-auto cursor-pointer border border-ink bg-lienzo px-4 py-3 shadow-[0_2px_12px_rgb(0_0_0/0.12)]"
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
