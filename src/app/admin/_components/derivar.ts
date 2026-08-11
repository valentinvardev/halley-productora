"use client";

/**
 * Achica una imagen en el navegador, antes de que salga hacia S3.
 *
 * El problema que resuelve no es el peso del archivo sino el de la pantalla. Un
 * JPEG de cámara de 24 MP pesa unos 8 MB en disco, pero al mostrarlo ocupa
 * ancho por alto por cuatro bytes en memoria: 92 MB. El mosaico de la vitrina
 * pone hasta treinta y dos celdas de esas, cada una dibujada en un recuadro de
 * 480x540. Se decodifica cien veces lo que se ve.
 *
 * Se hace acá y no en el servidor a propósito. Del lado del servidor haría falta
 * una librería de imágenes, CPU del VPS por cada foto y una cola para que subir
 * cincuenta no lo tumbe. Del lado del navegador ya está todo: el canvas
 * redimensiona, y de paso el que sube manda cuatro veces menos bytes, así que la
 * subida además termina antes.
 *
 * Si algo falla —un formato que el navegador no sabe decodificar, un canvas que
 * no da— se devuelve el archivo original. Que una foto entre pesada es un
 * problema; que no entre es otro peor.
 */

/** El lado más largo, en píxeles, de cada versión. */
export const LADO_MOSTRAR = 2400;
export const LADO_MINIATURA = 640;

/** Con qué calidad se re-comprime. WebP a 0,82 es indistinguible a simple vista. */
const CALIDAD = 0.82;

/**
 * Cuánto se puede achicar de una sola pasada sin que se note.
 *
 * `drawImage` toma muestras de a poco: bajando de 6000 a 640 de un saque se
 * saltea la mayoría de los píxeles y el resultado sale con los bordes crudos.
 * Bajando de a mitades, cada paso promedia lo que el anterior dejó y el
 * resultado queda parejo.
 */
const PASO_MAXIMO = 2;

function lienzo(ancho: number, alto: number) {
  const c = document.createElement("canvas");
  c.width = ancho;
  c.height = alto;
  return c;
}

async function aBlob(c: HTMLCanvasElement, tipo: string) {
  return new Promise<Blob | null>((listo) => c.toBlob(listo, tipo, CALIDAD));
}

/**
 * Devuelve la imagen achicada a `lado`, o el archivo original si no hace falta
 * achicarla o si el navegador no puede.
 */
export async function derivar(archivo: File, lado: number): Promise<File> {
  if (!archivo.type.startsWith("image/")) return archivo;

  let bitmap: ImageBitmap;
  try {
    // `from-image` aplica la rotación que la foto trae en su EXIF. Sin esto, las
    // fotos verticales de teléfono entran acostadas: al redibujarlas en un canvas
    // se pierde el EXIF, así que la rotación tiene que quedar horneada en los
    // píxeles.
    bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch {
    return archivo;
  }

  try {
    const mayor = Math.max(bitmap.width, bitmap.height);
    if (mayor <= lado) return archivo;

    const escala = lado / mayor;
    let ancho = bitmap.width;
    let alto = bitmap.height;
    let fuente: CanvasImageSource = bitmap;

    // Se baja de a mitades hasta quedar a un paso del destino, y ese último paso
    // llega justo. Una imagen de 6000 a 640 son tres pasos, no uno.
    const anchoDestino = Math.max(1, bitmap.width * escala);
    while (ancho / anchoDestino > PASO_MAXIMO) {
      const c = lienzo(
        Math.max(1, Math.round(ancho / 2)),
        Math.max(1, Math.round(alto / 2)),
      );
      c.getContext("2d")?.drawImage(fuente, 0, 0, c.width, c.height);
      ancho = c.width;
      alto = c.height;
      fuente = c;
    }

    // Nunca menos de un píxel: una panorámica muy alargada puede dar cero en el
    // lado corto, y un canvas de ancho cero tira.
    const destino = lienzo(
      Math.max(1, Math.round(bitmap.width * escala)),
      Math.max(1, Math.round(bitmap.height * escala)),
    );
    const ctx = destino.getContext("2d");
    if (!ctx) return archivo;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(fuente, 0, 0, destino.width, destino.height);

    const blob = await aBlob(destino, "image/webp");
    // Si por lo que sea salió más pesada que la original, no vale la pena.
    if (!blob || blob.size >= archivo.size) return archivo;

    return new File([blob], archivo.name.replace(/\.[^.]+$/, "") + ".webp", {
      type: "image/webp",
      lastModified: archivo.lastModified,
    });
  } catch {
    return archivo;
  } finally {
    bitmap.close();
  }
}
