import "server-only";

/**
 * Cuánto mide una imagen, leyéndole el encabezado.
 *
 * Los formatos guardan el ancho y el alto en los primeros bytes del archivo,
 * antes de los píxeles. Así que para saber la forma de una foto de ocho megas
 * no hace falta bajarla ni decodificarla: alcanza con el principio.
 *
 * Sin librería a propósito. La alternativa era `sharp`, que está en el árbol de
 * dependencias porque lo arrastra Next, pero no declarado por este proyecto:
 * apoyarse en eso es construir sobre algo que un cambio de lockfile puede
 * llevarse. Y es una librería nativa de varios megas para leer dos enteros.
 *
 * Cubre PNG, JPEG, WebP y GIF, que es lo que la subida acepta y produce. AVIF
 * queda afuera: su contenedor obliga a recorrer cajas anidadas, es el formato
 * menos usado de la lista y devolver `null` no rompe nada, sólo deja a esa
 * pieza sin medidas guardadas.
 */

export type Medidas = { ancho: number; alto: number };

/** Cuántos bytes alcanzan. Un JPEG con miniatura EXIF adentro es el peor caso. */
export const BYTES_DE_ENCABEZADO = 128 * 1024;

export function medidasDeBuffer(b: Uint8Array): Medidas | null {
  return png(b) ?? gif(b) ?? webp(b) ?? jpeg(b);
}

/* ------------------------------------------------------------ lectura cruda */

const u16be = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const u16le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8);
const u32be = (b: Uint8Array, i: number) =>
  ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;
const u24le = (b: Uint8Array, i: number) =>
  b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);

/** ¿Están estos bytes literales en esta posición? */
function marca(b: Uint8Array, i: number, texto: string) {
  for (let k = 0; k < texto.length; k++) {
    if (b[i + k] !== texto.charCodeAt(k)) return false;
  }
  return true;
}

const valida = (m: Medidas) =>
  m.ancho > 0 && m.alto > 0 && m.ancho < 100_000 && m.alto < 100_000 ? m : null;

/* -------------------------------------------------------------- un formato */

/** PNG: firma de ocho bytes y después el IHDR, que abre con las dos medidas. */
function png(b: Uint8Array): Medidas | null {
  if (b.length < 24 || !marca(b, 1, "PNG")) return null;
  return valida({ ancho: u32be(b, 16), alto: u32be(b, 20) });
}

/** GIF: las medidas están en la pantalla lógica, apenas pasada la firma. */
function gif(b: Uint8Array): Medidas | null {
  if (b.length < 10 || !marca(b, 0, "GIF8")) return null;
  return valida({ ancho: u16le(b, 6), alto: u16le(b, 8) });
}

/**
 * WebP: un contenedor RIFF con tres variantes que guardan las medidas en
 * lugares distintos. `VP8 ` es el con pérdida, `VP8L` el sin pérdida y `VP8X`
 * el extendido, que es el que sale cuando hay transparencia o animación.
 *
 * Las tres guardan el tamaño menos uno, o recortado a catorce bits, porque el
 * formato le pelea cada bit al encabezado.
 */
function webp(b: Uint8Array): Medidas | null {
  if (b.length < 30 || !marca(b, 0, "RIFF") || !marca(b, 8, "WEBP"))
    return null;

  if (marca(b, 12, "VP8X")) {
    return valida({ ancho: u24le(b, 24) + 1, alto: u24le(b, 27) + 1 });
  }

  if (marca(b, 12, "VP8L")) {
    // Catorce bits por lado, encimados: el ancho se lleva los dos primeros
    // bytes y medio, el alto sigue justo donde el otro termina.
    const crudo =
      (b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24)) >>> 0;
    return valida({
      ancho: (crudo & 0x3fff) + 1,
      alto: ((crudo >>> 14) & 0x3fff) + 1,
    });
  }

  if (marca(b, 12, "VP8 ")) {
    // Después del código de arranque de tres bytes vienen los dos lados, cada
    // uno en catorce bits: los dos de arriba son la escala y no el tamaño.
    return valida({
      ancho: u16le(b, 26) & 0x3fff,
      alto: u16le(b, 28) & 0x3fff,
    });
  }

  return null;
}

/**
 * JPEG: no hay una posición fija. El archivo es una fila de segmentos y las
 * medidas viven en el que arranca el cuadro, que puede estar detrás de una
 * miniatura EXIF de varios kilobytes. Así que hay que caminar la fila.
 */
function jpeg(b: Uint8Array): Medidas | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;

  let i = 2;
  while (i + 9 < b.length) {
    // Entre segmento y segmento puede haber relleno de 0xFF; se saltea.
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    let marcador = b[i + 1]!;
    while (marcador === 0xff && i + 2 < b.length) {
      i++;
      marcador = b[i + 1]!;
    }

    // Los que abren cuadro. Quedan afuera 0xC4, 0xC8 y 0xCC, que comparten el
    // rango pero son tablas y no cuadros.
    const abreCuadro =
      marcador >= 0xc0 &&
      marcador <= 0xcf &&
      marcador !== 0xc4 &&
      marcador !== 0xc8 &&
      marcador !== 0xcc;

    if (abreCuadro) {
      return valida({ ancho: u16be(b, i + 7), alto: u16be(b, i + 5) });
    }

    // 0xD8 y los 0xD0-0xD7 no traen largo; el resto sí, y con eso se salta.
    if (marcador === 0xd8 || (marcador >= 0xd0 && marcador <= 0xd7)) {
      i += 2;
      continue;
    }
    // Empieza el dato comprimido: de acá en adelante ya no hay encabezados.
    if (marcador === 0xda) return null;

    const largo = u16be(b, i + 2);
    if (largo < 2) return null;
    i += 2 + largo;
  }

  return null;
}
