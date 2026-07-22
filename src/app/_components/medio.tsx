import { existsSync } from "node:fs";
import path from "node:path";

import Image from "next/image";

import { IconoReproducir } from "./iconos";

/**
 * Hueco de multimedia.
 *
 * Halley todavía no cargó su material, así que cada hueco se dibuja igual: con
 * la proporción final y el nombre del archivo que espera. Sirve para dos
 * cosas — la página se puede ver y discutir hoy, y quien cargue el material
 * sabe exactamente dónde ponerlo sin tocar código.
 *
 * La existencia se consulta en el servidor, al renderizar. En cuanto el
 * archivo aparece en `public/`, el hueco pasa a mostrarlo solo.
 */

export function existeEnPublico(ruta: string) {
  return existsSync(path.join(process.cwd(), "public", ruta.replace(/^\//, "")));
}

export function Medio({
  src,
  alt,
  proporcion = "aspect-[4/3]",
  className = "",
  prioridad = false,
}: {
  /** Ruta dentro de `public`, por ejemplo `/muestras/bodas-01.jpg`. */
  src: string;
  alt: string;
  proporcion?: string;
  className?: string;
  prioridad?: boolean;
}) {
  const hay = existeEnPublico(src);
  const esVideo = /\.(mp4|webm)$/i.test(src);

  if (hay && esVideo) {
    return (
      <video
        src={src}
        muted
        loop
        autoPlay
        playsInline
        aria-label={alt}
        className={`${proporcion} w-full object-cover ${className}`}
      />
    );
  }

  if (hay) {
    return (
      <div className={`${proporcion} relative w-full overflow-hidden ${className}`}>
        <Image src={src} alt={alt} fill priority={prioridad} className="object-cover" />
      </div>
    );
  }

  return <Marcador src={src} alt={alt} proporcion={proporcion} className={className} />;
}

/** Lo que se ve mientras el archivo no está. */
function Marcador({
  src,
  alt,
  proporcion,
  className = "",
}: {
  src: string;
  alt: string;
  proporcion: string;
  className?: string;
}) {
  return (
    <div
      className={`${proporcion} relative flex w-full flex-col items-center justify-center gap-2 border border-dashed border-gray-20 bg-paper-dim px-4 text-center ${className}`}
    >
      <IconoReproducir className="h-4 w-4 text-gray-45" />
      <span className="font-rotulo text-[11px] uppercase tracking-[0.12em] text-gray-45">
        {alt}
      </span>
      <code className="font-mono text-[10px] break-all text-gray-45 opacity-70">
        public{src}
      </code>
    </div>
  );
}
