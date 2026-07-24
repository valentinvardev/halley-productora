"use client";

/**
 * Bajar una foto, resolviendo el problema de iOS.
 *
 * En una computadora o en Android, `download` en un `<a>` baja el archivo y
 * listo. En iOS eso no existe: Safari ignora `download` y abre la imagen, y el
 * usuario no tiene forma clara de guardarla en su galería.
 *
 * La salida es la Web Share API con el archivo como `File`: abre la hoja nativa
 * de iOS, que trae "Guardar imagen". Se baja el blob y se comparte. Si el
 * navegador no la soporta, se cae a la descarga común.
 *
 * (Es el mismo enfoque probado en otros proyectos, adaptado.)
 */

/** ¿Puede este navegador compartir archivos? Sólo iOS 15+ y algún Android. */
export function puedeCompartirArchivos() {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    canShare?: (d: ShareData) => boolean;
  };
  if (!nav.share || !nav.canShare) return false;
  try {
    const f = new File([""], "t.jpg", { type: "image/jpeg" });
    return nav.canShare({ files: [f] });
  } catch {
    return false;
  }
}

async function bajarComun(url: string, nombre: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Guarda una foto. `verUrl` es la que abre en el navegador; `descargaUrl`
 * fuerza el nombre original. Devuelve `"compartido"` si se abrió la hoja de
 * iOS, `"descargado"` si bajó normal, o lanza si el usuario cancela algo real.
 */
export async function guardarFoto(
  verUrl: string,
  descargaUrl: string,
  nombre: string,
): Promise<"compartido" | "descargado"> {
  if (puedeCompartirArchivos()) {
    try {
      const blob = await fetch(verUrl).then((r) => r.blob());
      const file = new File([blob], nombre, {
        type: blob.type || "image/jpeg",
      });
      const nav = navigator as Navigator & {
        share: (d: ShareData) => Promise<void>;
      };
      await nav.share({ files: [file] });
      return "compartido";
    } catch (e) {
      // Si el usuario cerró la hoja a propósito, no insistimos con una descarga.
      if (e instanceof DOMException && e.name === "AbortError") {
        return "compartido";
      }
      // Cualquier otra falla (sin permiso, blob que no vino): descarga común.
    }
  }

  await bajarComun(descargaUrl, nombre);
  return "descargado";
}
