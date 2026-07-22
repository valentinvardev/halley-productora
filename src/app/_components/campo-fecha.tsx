"use client";

import { useEffect, useRef, useState } from "react";

import { fecha } from "~/lib/format";
import { Marca } from "./marca";
import { Etiqueta } from "./ui";

/**
 * Selector de fecha propio.
 *
 * El `input type="date"` nativo trae el cromo del sistema operativo —ícono
 * azul, popover redondeado— que no tiene nada que ver con la hoja de contacto.
 * Este usa la misma grilla que la hoja: celdas cuadradas separadas por líneas
 * de 1px, y el día elegido va circulado a lápiz graso.
 *
 * El valor entra y sale como "AAAA-MM-DD", igual que el input nativo, así que
 * es un reemplazo directo.
 */

const DIAS = ["LU", "MA", "MI", "JU", "VI", "SA", "DO"];

const mesFmt = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
});

/** A "AAAA-MM-DD" en hora local — nada de toISOString, que corre un día. */
function aTexto(d: Date) {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function deTexto(texto: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function mismoDia(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function sumarDias(d: Date, dias: number) {
  const otro = new Date(d);
  otro.setDate(otro.getDate() + dias);
  return otro;
}

/** Celdas de la grilla, arrancando el lunes y completando la primera semana. */
function celdasDelMes(mes: Date) {
  const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const huecos = (primero.getDay() + 6) % 7; // lunes = 0
  const ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();

  const celdas: (Date | null)[] = Array<null>(huecos).fill(null);
  for (let dia = 1; dia <= ultimo; dia++) {
    celdas.push(new Date(mes.getFullYear(), mes.getMonth(), dia));
  }
  while (celdas.length % 7 !== 0) celdas.push(null);
  return celdas;
}

export function CampoFecha({
  label,
  valor,
  alCambiar,
  hint,
  className = "",
}: {
  label: string;
  /** "AAAA-MM-DD" o "" */
  valor: string;
  alCambiar: (valor: string) => void;
  hint?: string;
  className?: string;
}) {
  const seleccionada = deTexto(valor);
  const hoy = new Date();

  const [abierto, setAbierto] = useState(false);
  const [mes, setMes] = useState(() => seleccionada ?? hoy);
  const [foco, setFoco] = useState(() => seleccionada ?? hoy);
  const contenedor = useRef<HTMLDivElement>(null);
  const dialogo = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);

  // El calendario toma el foco al abrirse (para que anden las flechas) y se lo
  // devuelve al campo al cerrarse.
  useEffect(() => {
    if (abierto) dialogo.current?.focus();
    else if (document.activeElement === document.body) disparador.current?.focus();
  }, [abierto]);

  // Cerrar al hacer click afuera o con Escape.
  useEffect(() => {
    if (!abierto) return;

    function afuera(e: PointerEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }

    document.addEventListener("pointerdown", afuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", afuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  function elegir(dia: Date) {
    alCambiar(aTexto(dia));
    setAbierto(false);
  }

  function abrir() {
    const base = seleccionada ?? hoy;
    setMes(base);
    setFoco(base);
    setAbierto(true);
  }

  function teclas(e: React.KeyboardEvent) {
    const saltos: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (saltos[e.key] !== undefined) {
      e.preventDefault();
      const nuevo = sumarDias(foco, saltos[e.key]!);
      setFoco(nuevo);
      setMes(nuevo);
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      elegir(foco);
    }
  }

  return (
    <div className={`relative flex flex-col gap-1.5 ${className}`} ref={contenedor}>
      <Etiqueta>{label}</Etiqueta>

      <button
        type="button"
        ref={disparador}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className="flex items-center justify-between border border-ink bg-lienzo px-3 py-[11px] text-left font-mono text-[13px]"
      >
        {seleccionada ? (
          fecha(seleccionada)
        ) : (
          <span className="text-gray-45">DD/MM/AAAA</span>
        )}
        <span className="ml-3 text-[10px] tracking-[0.1em] text-gray-45">
          {abierto ? "▴" : "▾"}
        </span>
      </button>

      {hint && <span className="nota text-[11.5px] text-gray-45">{hint}</span>}

      {abierto && (
        <div
          role="dialog"
          aria-label="Elegir fecha"
          onKeyDown={teclas}
          tabIndex={-1}
          ref={dialogo}
          className="absolute top-full left-0 z-50 mt-1 w-[262px] border border-ink bg-paper"
        >
          {/* Mes */}
          <div className="flex items-center justify-between border-b border-ink px-2 py-2">
            <button
              type="button"
              onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}
              aria-label="Mes anterior"
              className="px-2 py-1 font-mono text-[13px] hover:bg-ink hover:text-paper"
            >
              ‹
            </button>
            <span className="font-rotulo text-[13px] uppercase tracking-[0.08em]">
              {mesFmt.format(mes)}
            </span>
            <button
              type="button"
              onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}
              aria-label="Mes siguiente"
              className="px-2 py-1 font-mono text-[13px] hover:bg-ink hover:text-paper"
            >
              ›
            </button>
          </div>

          {/* Encabezado de la semana */}
          <div className="grid grid-cols-7 border-b border-gray-20">
            {DIAS.map((d) => (
              <div
                key={d}
                className="py-1.5 text-center font-rotulo text-[11.5px] tracking-[0.06em] text-gray-45"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grilla, como la hoja de contacto */}
          <div className="grid grid-cols-7">
            {celdasDelMes(mes).map((dia, i) => {
              if (!dia) {
                return (
                  <div
                    key={`vacio-${i}`}
                    className="aspect-square border-t border-r border-gray-20 [&:nth-child(7n)]:border-r-0"
                  />
                );
              }

              const elegido = seleccionada && mismoDia(dia, seleccionada);
              const esHoy = mismoDia(dia, hoy);
              const enfocado = mismoDia(dia, foco);

              return (
                <button
                  key={aTexto(dia)}
                  type="button"
                  onClick={() => elegir(dia)}
                  onMouseEnter={() => setFoco(dia)}
                  aria-current={elegido ? "date" : undefined}
                  className={`relative aspect-square border-t border-r border-gray-20 font-mono text-[12px] [&:nth-child(7n)]:border-r-0 ${
                    enfocado && !elegido ? "bg-paper-dim" : ""
                  }`}
                >
                  <span className={esHoy && !elegido ? "underline underline-offset-4" : ""}>
                    {dia.getDate()}
                  </span>

                  {elegido && (
                    <span className="pointer-events-none absolute inset-[3px]">
                      <Marca
                        tipo="circulado"
                        className="h-full w-full"
                        grosor={3}
                        color="var(--color-ink)"
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-ink px-2 py-1.5">
            <button
              type="button"
              onClick={() => elegir(hoy)}
              className="px-1.5 py-1 font-rotulo text-[12px] uppercase tracking-[0.06em] text-gray-70 hover:text-ink"
            >
              Hoy
            </button>
            <span className="nota text-[11px] text-gray-45">
              ← ↑ ↓ → para moverte
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
