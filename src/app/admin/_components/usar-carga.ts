"use client";

import { useCallback, useRef, useState } from "react";

import { api } from "~/trpc/react";

/**
 * La cola de subida a S3, compartida por el resumen y la galería.
 *
 * Cada archivo pasa por tres pasos —firmar la URL, subir a S3, guardar la
 * fila— y la cola reporta en cuál está y cuánto lleva. El PUT va por XHR y no
 * por fetch porque XHR sí da progreso de subida: es lo que hace que la barra de
 * cada foto avance de verdad en vez de saltar de 0 a 100.
 */

export type EstadoCarga = "pendiente" | "subiendo" | "listo" | "error";

export type ItemCarga = {
  id: string;
  nombre: string;
  estado: EstadoCarga;
  /** 0–100 mientras sube. */
  progreso: number;
};

const ACEPTA = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
]);

/** PUT con progreso. fetch no expone `upload.onprogress`; XHR sí. */
function subirConProgreso(
  url: string,
  file: File,
  alProgreso: (pct: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) alProgreso(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`S3 respondió ${xhr.status}`));
    xhr.onerror = () => reject(new Error("Falló la conexión con S3"));
    xhr.send(file);
  });
}

export function useCargaContenido(categoria: string, alCompletar: () => void) {
  const [cola, setCola] = useState<ItemCarga[]>([]);
  const [activo, setActivo] = useState(false);
  const contador = useRef(0);

  const firmar = api.contenido.urlDeSubida.useMutation();
  const guardar = api.contenido.guardar.useMutation();

  const parche = useCallback((id: string, cambios: Partial<ItemCarga>) => {
    setCola((cs) => cs.map((c) => (c.id === id ? { ...c, ...cambios } : c)));
  }, []);

  const subir = useCallback(
    async (archivos: FileList | File[]) => {
      const validos = Array.from(archivos).filter((f) => ACEPTA.has(f.type));
      if (validos.length === 0) return;

      const items: ItemCarga[] = validos.map((f) => ({
        id: `c${contador.current++}`,
        nombre: f.name,
        estado: "pendiente",
        progreso: 0,
      }));
      setCola((cs) => [...cs, ...items]);
      setActivo(true);

      // De a una: la cola avanza y no se satura la subida ni el ancho de banda.
      for (let i = 0; i < validos.length; i++) {
        const item = items[i]!;
        const file = validos[i]!;
        try {
          parche(item.id, { estado: "subiendo", progreso: 0 });
          const { url, key, tipo } = await firmar.mutateAsync({
            categoria,
            contentType: file.type,
          });
          await subirConProgreso(url, file, (p) =>
            parche(item.id, { progreso: p }),
          );
          await guardar.mutateAsync({ categoria, s3Key: key, tipo });
          parche(item.id, { estado: "listo", progreso: 100 });
          // Cada una que entra ya se ve reflejada, sin esperar al resto.
          alCompletar();
        } catch {
          parche(item.id, { estado: "error" });
        }
      }

      setActivo(false);
    },
    [categoria, firmar, guardar, parche, alCompletar],
  );

  const limpiar = useCallback(() => setCola([]), []);

  return { cola, activo, subir, limpiar };
}
