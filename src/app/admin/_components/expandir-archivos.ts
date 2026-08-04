"use client";

import { unzip } from "fflate";

/**
 * Convierte lo que el admin haya soltado en una lista plana de archivos.
 *
 * Da lo mismo si eligió fotos sueltas, arrastró una carpeta entera o soltó un
 * ZIP: de acá sale siempre lo mismo, y la cola de subida no se entera de la
 * diferencia.
 *
 * El ZIP se abre en el navegador, no en el servidor. Así el archivo no viaja
 * dos veces —una para descomprimir y otra para guardar— y cada foto sale
 * derecho a S3 por su URL firmada, como cualquier otra.
 */

const TIPOS: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
};

/** El tipo sale de la extensión: una entrada de ZIP no trae MIME. */
function tipoDe(nombre: string) {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  return TIPOS[ext] ?? "";
}

/**
 * Lo que hay que ignorar de una carpeta o un ZIP.
 *
 * Los `__MACOSX` y `._algo` los mete macOS al comprimir y son metadatos, no
 * fotos: sin este filtro se suben como archivos rotos. Las carpetas ocultas
 * tampoco tienen por qué entrar.
 */
function esBasura(ruta: string) {
  const partes = ruta.split("/");
  return partes.some(
    (p) => p === "__MACOSX" || p.startsWith("._") || p.startsWith("."),
  );
}

function esZip(f: File) {
  return (
    f.name.toLowerCase().endsWith(".zip") ||
    f.type === "application/zip" ||
    f.type === "application/x-zip-compressed"
  );
}

function abrirZip(datos: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolver, rechazar) => {
    unzip(datos, (err, salida) => (err ? rechazar(err) : resolver(salida)));
  });
}

export type ResultadoExpansion = {
  archivos: File[];
  /** Lo que se dejó afuera por no ser una foto o un video que sepamos subir. */
  descartados: number;
};

export async function expandirArchivos(
  entrada: FileList | File[],
): Promise<ResultadoExpansion> {
  const sueltos = Array.from(entrada);
  const archivos: File[] = [];
  let descartados = 0;

  for (const f of sueltos) {
    if (esZip(f)) {
      try {
        const contenido = await abrirZip(new Uint8Array(await f.arrayBuffer()));
        for (const [ruta, datos] of Object.entries(contenido)) {
          // Las carpetas entran como entradas vacías: se saltean.
          if (ruta.endsWith("/") || datos.length === 0) continue;
          if (esBasura(ruta)) continue;

          const nombre = ruta.split("/").pop() ?? ruta;
          const tipo = tipoDe(nombre);
          if (!tipo) {
            descartados += 1;
            continue;
          }
          archivos.push(
            new File([datos as BlobPart], nombre, { type: tipo }),
          );
        }
      } catch {
        // Un ZIP que no se puede abrir se cuenta como descartado y no frena a
        // los demás: puede haber soltado varios de una.
        descartados += 1;
      }
      continue;
    }

    // De una carpeta llegan también los archivos que no son media.
    const ruta = (f as File & { webkitRelativePath?: string })
      .webkitRelativePath;
    if (ruta && esBasura(ruta)) continue;

    if (!tipoDe(f.name)) {
      descartados += 1;
      continue;
    }
    archivos.push(f);
  }

  return { archivos, descartados };
}
