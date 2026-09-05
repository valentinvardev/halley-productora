/**
 * Videos de YouTube en la vitrina.
 *
 * Un video no listado de YouTube es la forma barata de mostrar un trabajo largo
 * sin pagar el almacenamiento ni la transferencia: el archivo vive en YouTube y
 * acá se guarda sólo su id. Estas funciones son lo mínimo para entenderse con
 * eso: sacar el id de cualquier link que la gente pegue, y armar las dos
 * direcciones que hacen falta, la de la miniatura y la del embebido.
 *
 * En la base el video ocupa una fila de `Contenido` como cualquier pieza, con la
 * `s3Key` puesta en un centinela `youtube:{categoría}:{id}`. Es lo que deja que
 * se ordene, se borre y se titule con el mismo código que las demás, y el
 * centinela lleva la categoría para que el mismo video pueda estar en dos.
 */

const ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * El id de un video a partir de lo que sea que pegaron: el link largo, el corto
 * de youtu.be, un short, un embed, o el id pelado.
 */
export function idDeYoutube(entrada: string): string | null {
  const texto = entrada.trim();
  if (ID.test(texto)) return texto;

  let url: URL;
  try {
    url = new URL(texto.includes("://") ? texto : `https://${texto}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (!["youtube.com", "youtube-nocookie.com", "youtu.be"].includes(host)) {
    return null;
  }

  const candidatos = [
    url.searchParams.get("v"),
    ...url.pathname.split("/").filter(Boolean),
  ].filter((x): x is string => !!x);

  // En youtu.be el id es el primer tramo; en los demás, el que sigue a
  // "embed", "shorts" o "live", o el parámetro v.
  return candidatos.find((c) => ID.test(c)) ?? null;
}

export const PREFIJO_YOUTUBE = "youtube:";

export function esClaveYoutube(s3Key: string) {
  return s3Key.startsWith(PREFIJO_YOUTUBE);
}

export function claveYoutube(categoria: string, id: string) {
  return `${PREFIJO_YOUTUBE}${categoria}:${id}`;
}

/** La miniatura grande que YouTube genera para todo video. */
export function miniaturaYoutube(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/**
 * El embebido, por el dominio sin cookies y con lo de YouTube al mínimo: sin
 * videos relacionados de otros canales al terminar, sin logo grande, barra en
 * blanco para acercarse al tono del sitio. Los controles siguen siendo los de
 * YouTube: reemplazarlos requiere su SDK, que no se carga por la política de
 * seguridad del sitio.
 */
export function embedYoutube(id: string) {
  const q = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    modestbranding: "1",
    color: "white",
    playsinline: "1",
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${q.toString()}`;
}
