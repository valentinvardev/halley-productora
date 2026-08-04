"use client";

import { useRef, useState } from "react";

import { IconoMas } from "~/app/_components/iconos";
import { Boton } from "~/app/_components/ui";
import { expandirArchivos } from "./expandir-archivos";

const ACEPTA = "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm";
const ACEPTA_ZIP = `${ACEPTA},.zip,application/zip,application/x-zip-compressed`;

/**
 * Las tres formas de cargar material: archivos sueltos, una carpeta entera o un
 * ZIP.
 *
 * Son tres entradas de archivo y no una porque el navegador no deja mezclar:
 * `webkitdirectory` convierte el diálogo en un selector de carpetas y deja de
 * poder elegir archivos. Para el que sube doscientas fotos de un evento, la
 * carpeta y el ZIP son la diferencia entre un clic y doscientos.
 */
export function BotonesSubida({
  alElegir,
  ocupado = false,
}: {
  alElegir: (archivos: File[]) => void | Promise<void>;
  ocupado?: boolean;
}) {
  const sueltos = useRef<HTMLInputElement>(null);
  const carpeta = useRef<HTMLInputElement>(null);
  const [abriendo, setAbriendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function tomar(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    setAbriendo(true);
    setAviso(null);
    try {
      const { archivos, descartados } = await expandirArchivos(lista);
      if (archivos.length === 0) {
        setAviso(
          descartados > 0
            ? "No había fotos ni videos que se puedan subir."
            : "No se encontró nada para subir.",
        );
        return;
      }
      setAviso(
        descartados > 0
          ? `${archivos.length} para subir · ${descartados} salteados por formato`
          : null,
      );
      await alElegir(archivos);
    } finally {
      setAbriendo(false);
    }
  }

  const trabajando = ocupado || abriendo;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Boton onClick={() => sueltos.current?.click()} disabled={trabajando}>
        <IconoMas />
        {abriendo ? "Abriendo…" : "Subir"}
      </Boton>

      <Boton
        variante="fantasma"
        onClick={() => carpeta.current?.click()}
        disabled={trabajando}
      >
        Subir carpeta
      </Boton>

      {/* Sueltos y ZIP comparten la entrada: los dos salen del mismo diálogo. */}
      <input
        ref={sueltos}
        type="file"
        accept={ACEPTA_ZIP}
        multiple
        className="hidden"
        onChange={(e) => {
          void tomar(e.target.files);
          e.target.value = "";
        }}
      />

      {/* `webkitdirectory` no está en los tipos de React, pero lo entienden
          todos los navegadores de escritorio. */}
      <input
        ref={carpeta}
        type="file"
        multiple
        className="hidden"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...({ webkitdirectory: "", directory: "" } as any)}
        onChange={(e) => {
          void tomar(e.target.files);
          e.target.value = "";
        }}
      />

      {aviso && <span className="nota text-[11.5px]">{aviso}</span>}
    </div>
  );
}
