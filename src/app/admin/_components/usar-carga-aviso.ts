"use client";

import { useCallback, useRef, useState } from "react";

import { api } from "~/trpc/react";
import type { ItemCarga } from "./usar-carga";

/**
 * La misma cola de subida a S3, pero para las imágenes de un aviso.
 *
 * En un aviso sólo entran imágenes: un video adentro de un texto informativo no
 * aporta y complica el visor. Por eso la lista de tipos es más corta que la de
 * la galería.
 */

const ACEPTA = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const CONCURRENCIA = 6;

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

export function useCargaAviso(avisoId: string, alCompletar: () => void) {
  const [cola, setCola] = useState<ItemCarga[]>([]);
  const [activo, setActivo] = useState(false);
  const contador = useRef(0);

  const firmar = api.aviso.urlDeSubida.useMutation();
  const guardar = api.aviso.guardarFoto.useMutation();

  const parche = useCallback((id: string, cambios: Partial<ItemCarga>) => {
    setCola((cs) => cs.map((c) => (c.id === id ? { ...c, ...cambios } : c)));
  }, []);

  const subir = useCallback(
    async (archivos: FileList | File[]) => {
      const validos = Array.from(archivos).filter((f) => ACEPTA.has(f.type));
      if (validos.length === 0) return;

      const items: ItemCarga[] = validos.map((f) => ({
        id: `g${contador.current++}`,
        nombre: f.name,
        estado: "pendiente",
        progreso: 0,
      }));
      setCola((cs) => [...cs, ...items]);
      setActivo(true);

      const tareas = items.map((item, i) => ({ item, file: validos[i]! }));
      let cursor = 0;
      let entroAlguna = false;

      const worker = async () => {
        while (cursor < tareas.length) {
          const { item, file } = tareas[cursor++]!;
          try {
            parche(item.id, { estado: "subiendo", progreso: 0 });
            const { url, key } = await firmar.mutateAsync({
              avisoId,
              contentType: file.type,
            });
            await subirConProgreso(url, file, (p) =>
              parche(item.id, { progreso: p }),
            );
            await guardar.mutateAsync({
              avisoId,
              s3Key: key,
              nombre: file.name,
            });
            parche(item.id, { estado: "listo", progreso: 100 });
            entroAlguna = true;
          } catch {
            parche(item.id, { estado: "error" });
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCIA, tareas.length) }, worker),
      );

      if (entroAlguna) alCompletar();
      setActivo(false);
    },
    [avisoId, firmar, guardar, parche, alCompletar],
  );

  const limpiar = useCallback(() => setCola([]), []);

  return { cola, activo, subir, limpiar };
}
