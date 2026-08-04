"use client";

import { useRef, useState } from "react";

import { archivosDeArrastre } from "./arrastre";
import { expandirArchivos } from "./expandir-archivos";

/**
 * Un bloque que acepta que le suelten cosas encima.
 *
 * Da lo mismo qué se suelte —fotos, una carpeta, un ZIP—: sale la misma lista
 * plana que dan los botones, y la cola de subida no se entera de por dónde
 * entró.
 *
 * El contador de entradas y salidas no es capricho: al pasar el puntero sobre
 * un hijo, el navegador dispara `dragleave` del padre, y con un booleano el
 * resaltado titila todo el tiempo. Contando, sólo se apaga cuando de verdad se
 * salió de todo.
 */
export function ZonaArrastre({
  alSoltar,
  deshabilitada = false,
  className = "",
  children,
}: {
  alSoltar: (archivos: File[]) => void | Promise<void>;
  deshabilitada?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [encima, setEncima] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const profundidad = useRef(0);

  /** Sólo se resalta si lo que viene son archivos, no texto de otra pestaña. */
  const traeArchivos = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types ?? []).includes("Files");

  function limpiar() {
    profundidad.current = 0;
    setEncima(false);
  }

  return (
    <div
      className={`relative ${className}`}
      onDragEnter={(e) => {
        if (deshabilitada || !traeArchivos(e)) return;
        e.preventDefault();
        profundidad.current += 1;
        setEncima(true);
      }}
      onDragOver={(e) => {
        if (deshabilitada || !traeArchivos(e)) return;
        // Sin esto el navegador abre el archivo en una pestaña en vez de
        // dejárnoslo soltar.
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        if (deshabilitada) return;
        profundidad.current -= 1;
        if (profundidad.current <= 0) limpiar();
      }}
      onDrop={(e) => {
        if (deshabilitada || !traeArchivos(e)) return;
        e.preventDefault();
        limpiar();

        void (async () => {
          setAbriendo(true);
          try {
            const sueltos = await archivosDeArrastre(e.dataTransfer);
            const { archivos } = await expandirArchivos(sueltos);
            if (archivos.length > 0) await alSoltar(archivos);
          } finally {
            setAbriendo(false);
          }
        })();
      }}
    >
      {children}

      {(encima || abriendo) && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center border-2 border-dashed border-ink bg-paper/85">
          <span className="font-rotulo text-[12px] uppercase tracking-[0.1em]">
            {abriendo ? "Abriendo…" : "Soltá para subir"}
          </span>
        </div>
      )}
    </div>
  );
}
