"use client";

import { useEffect, useRef, useState } from "react";

import { Etiqueta } from "./ui";

/**
 * Desplegable propio.
 *
 * El `<select>` nativo abre el menú del sistema operativo, que en Windows y en
 * Android no se parece en nada al resto: esquinas redondeadas, tipografía
 * ajena, resaltado azul. Éste usa la misma caja de 1px del sistema y la opción
 * elegida se resalta invirtiendo tinta y papel, como los botones.
 */

export type Opcion = {
  valor: string;
  etiqueta: string;
  /** Renglón chico a la derecha (ej. "ya registrado"). */
  nota?: string;
  deshabilitada?: boolean;
};

export function Desplegable({
  label,
  opciones,
  valor,
  alCambiar,
  placeholder = "Elegí una opción",
  vacio = "No hay opciones",
  className = "",
}: {
  label: string;
  opciones: Opcion[];
  valor: string | null;
  alCambiar: (valor: string) => void;
  placeholder?: string;
  vacio?: string;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [foco, setFoco] = useState(0);
  const contenedor = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);

  const elegida = opciones.find((o) => o.valor === valor) ?? null;
  const seleccionables = opciones.filter((o) => !o.deshabilitada);

  useEffect(() => {
    if (!abierto) return;

    function afuera(e: PointerEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("pointerdown", afuera);
    return () => document.removeEventListener("pointerdown", afuera);
  }, [abierto]);

  useEffect(() => {
    if (abierto) lista.current?.focus();
  }, [abierto]);

  function elegir(opcion: Opcion) {
    if (opcion.deshabilitada) return;
    alCambiar(opcion.valor);
    setAbierto(false);
    disparador.current?.focus();
  }

  function teclas(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setAbierto(false);
      disparador.current?.focus();
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (seleccionables.length === 0) return;
      const paso = e.key === "ArrowDown" ? 1 : -1;
      setFoco((f) => {
        const total = seleccionables.length;
        return (f + paso + total) % total;
      });
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opcion = seleccionables[foco];
      if (opcion) elegir(opcion);
    }
  }

  return (
    <div className={`relative flex flex-col gap-1.5 ${className}`} ref={contenedor}>
      <Etiqueta>{label}</Etiqueta>

      <button
        type="button"
        ref={disparador}
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className="flex items-center justify-between gap-3 border border-ink bg-lienzo px-3 py-[11px] text-left text-[14px]"
      >
        <span className={elegida ? "" : "text-gray-45"}>
          {elegida?.etiqueta ?? placeholder}
        </span>
        <span className="font-mono text-[10px] tracking-[0.1em] text-gray-45">
          {abierto ? "▴" : "▾"}
        </span>
      </button>

      {abierto && (
        <div
          role="listbox"
          tabIndex={-1}
          ref={lista}
          onKeyDown={teclas}
          className="absolute top-full left-0 z-50 mt-1 max-h-[280px] w-full overflow-y-auto border border-ink bg-paper"
        >
          {opciones.length === 0 && (
            <div className="px-3 py-3 font-rotulo text-[11.5px] uppercase tracking-[0.06em] text-gray-45">
              {vacio}
            </div>
          )}

          {opciones.map((opcion) => {
            const enfocada =
              !opcion.deshabilitada &&
              seleccionables[foco]?.valor === opcion.valor;
            const activa = opcion.valor === valor;

            return (
              <button
                key={opcion.valor}
                type="button"
                role="option"
                aria-selected={activa}
                disabled={opcion.deshabilitada}
                onClick={() => elegir(opcion)}
                onMouseEnter={() => {
                  const i = seleccionables.findIndex(
                    (o) => o.valor === opcion.valor,
                  );
                  if (i >= 0) setFoco(i);
                }}
                className={`flex w-full items-center justify-between gap-3 border-b border-gray-20 px-3 py-2.5 text-left text-[13.5px] last:border-b-0 ${
                  opcion.deshabilitada
                    ? "cursor-not-allowed text-gray-45"
                    : activa
                      ? "bg-ink text-paper"
                      : enfocada
                        ? "bg-paper-dim"
                        : ""
                }`}
              >
                <span>{opcion.etiqueta}</span>
                {opcion.nota && (
                  <span className="font-rotulo text-[10.5px] uppercase tracking-[0.06em] opacity-70">
                    {opcion.nota}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
