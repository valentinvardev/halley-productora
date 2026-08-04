"use client";

/**
 * Sacar los archivos de algo que alguien soltó encima.
 *
 * `dataTransfer.files` alcanza para archivos sueltos, pero de una carpeta
 * devuelve la carpeta misma y nada de lo que tiene adentro. Para recorrerla hay
 * que pasar por la API de entradas del navegador, que es vieja y tiene dos
 * trampas conocidas:
 *
 * 1. La lista de `items` se vacía apenas termina el manejador del `drop`, así
 *    que hay que quedarse con las entradas *antes* de esperar nada.
 * 2. `readEntries` devuelve como mucho cien por llamada, y hay que seguir
 *    pidiendo hasta que conteste vacío. Una carpeta con más fotos que eso se
 *    sube a medias si no se hace, y el bug es difícil de ver: parece que
 *    "funciona".
 */

type Entrada = {
  isFile: boolean;
  isDirectory: boolean;
  file?: (cb: (f: File) => void, err?: (e: unknown) => void) => void;
  createReader?: () => {
    readEntries: (cb: (e: Entrada[]) => void, err?: (e: unknown) => void) => void;
  };
};

function archivoDe(entrada: Entrada): Promise<File | null> {
  return new Promise((resolver) => {
    entrada.file?.(
      (f) => resolver(f),
      () => resolver(null),
    );
  });
}

/** Una tanda de hasta cien entradas. Se llama hasta que devuelva vacío. */
function leerTanda(lector: {
  readEntries: (cb: (e: Entrada[]) => void, err?: (e: unknown) => void) => void;
}): Promise<Entrada[]> {
  return new Promise((resolver) => {
    lector.readEntries(
      (e) => resolver(e),
      () => resolver([]),
    );
  });
}

async function recorrer(entrada: Entrada, salida: File[]) {
  if (entrada.isFile) {
    const f = await archivoDe(entrada);
    if (f) salida.push(f);
    return;
  }

  if (!entrada.isDirectory || !entrada.createReader) return;

  const lector = entrada.createReader();
  for (;;) {
    const tanda = await leerTanda(lector);
    if (tanda.length === 0) break;
    for (const hija of tanda) await recorrer(hija, salida);
  }
}

/**
 * Todo lo que se soltó, aplanado: los archivos sueltos y lo que haya dentro de
 * las carpetas. Los ZIP salen de acá como archivos y los abre `expandirArchivos`.
 */
export async function archivosDeArrastre(dt: DataTransfer): Promise<File[]> {
  // Las entradas se toman ya mismo, en el mismo turno del evento: después la
  // lista queda vacía y no hay forma de recuperarla.
  const entradas: Entrada[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== "file") continue;
    const entrada = (
      item as DataTransferItem & { webkitGetAsEntry?: () => Entrada | null }
    ).webkitGetAsEntry?.();
    if (entrada) entradas.push(entrada);
  }

  // Sin soporte de entradas —navegadores viejos— queda lo que se pueda: los
  // archivos sueltos, sin abrir carpetas.
  if (entradas.length === 0) return Array.from(dt.files ?? []);

  const salida: File[] = [];
  for (const e of entradas) await recorrer(e, salida);
  return salida;
}
