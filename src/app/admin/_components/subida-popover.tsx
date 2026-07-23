"use client";

import { IconoCruz, IconoTilde } from "~/app/_components/iconos";
import type { ItemCarga } from "./usar-carga";

/**
 * El popover de subida.
 *
 * Aparece abajo a la derecha cuando hay algo subiendo y lista la cola: cada
 * archivo con su barra, y arriba cuántas van de cuántas. De alto limitado y con
 * scroll propio, para que una tanda de cincuenta fotos no ocupe la pantalla. Se
 * cierra solo cuando terminó todo.
 */
export function SubidaPopover({
  cola,
  activo,
  alCerrar,
}: {
  cola: ItemCarga[];
  activo: boolean;
  alCerrar: () => void;
}) {
  if (cola.length === 0) return null;

  const listas = cola.filter((c) => c.estado === "listo").length;
  const conError = cola.filter((c) => c.estado === "error").length;
  const total = cola.length;

  return (
    <div className="fixed right-4 bottom-4 z-50 w-[min(340px,calc(100vw-2rem))] border border-ink bg-paper shadow-[6px_6px_0_rgba(0,0,0,0.12)]">
      <header className="flex items-center justify-between gap-3 border-b border-ink px-4 py-3">
        <div className="font-rotulo text-[12px] uppercase tracking-[0.08em]">
          {activo
            ? `Subiendo ${listas + conError} de ${total}`
            : conError > 0
              ? `${listas} listas · ${conError} con error`
              : `${listas} ${listas === 1 ? "foto subida" : "fotos subidas"}`}
        </div>
        {/* Sólo se puede cerrar cuando ya no hay nada en vuelo. */}
        <button
          type="button"
          onClick={alCerrar}
          disabled={activo}
          aria-label="Cerrar"
          className="cursor-pointer text-gray-45 hover:text-ink disabled:opacity-30"
        >
          <IconoCruz className="h-3.5 w-3.5" />
        </button>
      </header>

      <ul className="max-h-[46vh] overflow-y-auto">
        {cola.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 border-b border-gray-20 px-4 py-2.5 last:border-b-0"
          >
            <span className="grid h-4 w-4 shrink-0 place-items-center">
              {c.estado === "listo" ? (
                <IconoTilde className="h-3.5 w-3.5 text-ink" />
              ) : c.estado === "error" ? (
                <IconoCruz className="h-3 w-3 text-marca" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-gray-45" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[11px]">{c.nombre}</div>
              {/* La barra: llena en verde neutro mientras sube, marca al fallar. */}
              <div className="mt-1 h-[3px] w-full bg-gray-20">
                <div
                  className={`h-full transition-[width] duration-200 ${
                    c.estado === "error" ? "bg-marca" : "bg-ink"
                  }`}
                  style={{ width: `${c.estado === "listo" ? 100 : c.progreso}%` }}
                />
              </div>
            </div>

            <span className="shrink-0 font-rotulo text-[10px] uppercase tracking-[0.06em] text-gray-45">
              {c.estado === "listo"
                ? "OK"
                : c.estado === "error"
                  ? "Error"
                  : c.estado === "subiendo"
                    ? `${c.progreso}%`
                    : "…"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
