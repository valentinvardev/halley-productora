"use client";

import { useEffect, useRef, useState } from "react";

/**
 * El fondo de cada tipo de evento: una grilla de trabajos, no una sola foto.
 *
 * Es la hoja de contacto del manual llevada al fondo del panel — varias tomas a
 * la vez, en cuadrícula, separadas por una línea fina. Muestra más trabajo de un
 * vistazo que una portada sola, que es de lo que se trata la sección.
 *
 * Las piezas ya vienen barajadas del servidor: en cada visita entran otras.
 */

/** Cuántas celdas tiene la grilla en cada tamaño de pantalla. */
const CELDAS_MOVIL = 6;
const CELDAS_ANCHO = 8;

export function MosaicoPortadas({
  piezas,
}: {
  piezas: { id: string; tipo: "imagen" | "video"; url: string }[];
}) {
  // En un teléfono entran menos celdas: pedirle nueve fotos a una pantalla
  // angosta las deja del tamaño de una estampilla y no se ve nada.
  const [ancho, setAncho] = useState(false);
  const grilla = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const consulta = window.matchMedia("(min-width: 768px)");
    const leer = () => setAncho(consulta.matches);
    leer();
    consulta.addEventListener("change", leer);
    return () => consulta.removeEventListener("change", leer);
  }, []);

  /**
   * Los videos de las celdas sólo corren mientras su panel está a la vista.
   *
   * Antes iban todos con `autoplay`: cuatro categorías por hasta ocho celdas son
   * treinta y dos decodificadores de video andando a la vez, la mayoría en
   * paneles que están a tres pantallas de distancia. En un teléfono eso es más
   * de lo que hay.
   */
  useEffect(() => {
    const g = grilla.current;
    if (!g) return;

    const videos = () => Array.from(g.querySelectorAll("video"));
    const mirando = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada) return;
        for (const v of videos()) {
          if (entrada.isIntersecting) void v.play().catch(() => undefined);
          else v.pause();
        }
      },
      { rootMargin: "10%" },
    );

    mirando.observe(g);
    return () => mirando.disconnect();
  }, [ancho, piezas]);

  if (piezas.length === 0) return null;

  const cuantas = ancho ? CELDAS_ANCHO : CELDAS_MOVIL;

  // Si hay menos piezas que celdas, se repiten para no dejar huecos: acá sí
  // conviene, porque un agujero negro en la grilla se lee como un error.
  const celdas = Array.from(
    { length: cuantas },
    (_, i) => piezas[i % piezas.length]!,
  );

  return (
    <div
      ref={grilla}
      className="absolute inset-0 grid grid-cols-2 gap-px bg-gray-20 md:grid-cols-4"
      aria-hidden="true"
    >
      {celdas.map((p, i) => (
        <div key={`${p.id}-${i}`} className="relative overflow-hidden bg-black">
          {p.tipo === "video" ? (
            <video
              src={p.url}
              muted
              loop
              playsInline
              preload="none"
              disablePictureInPicture
              disableRemotePlayback
              className="h-full w-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.url}
              alt=""
              loading={i < 4 ? "eager" : "lazy"}
              className="h-full w-full object-cover"
            />
          )}
        </div>
      ))}
    </div>
  );
}
