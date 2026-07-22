/**
 * Esperas.
 *
 * `Bloque` y `Esqueleto` se usan cuando ya sabemos qué forma va a tener la
 * pantalla: se dibuja esa forma en gris y el contenido la reemplaza sin que
 * nada salte de lugar. `BarraCarga` es para lo otro — cuando esperamos algo de
 * afuera, como que se acredite una transferencia, y no hay forma que anticipar.
 *
 * Ninguno de los dos lleva la palabra "cargando": la espera se ve, no se
 * explica.
 */

/** Un rectángulo gris del tamaño de lo que va a venir. */
export function Bloque({ className = "" }: { className?: string }) {
  return <div className={`esqueleto bg-gray-20 ${className}`} />;
}

/** Línea de texto simulada. El ancho se pasa por clase. */
export function Linea({ className = "h-3 w-32" }: { className?: string }) {
  return <Bloque className={className} />;
}

/**
 * Barra indeterminada: no promete un porcentaje que no conocemos, sólo dice
 * que algo sigue pasando.
 */
export function BarraCarga({ className = "" }: { className?: string }) {
  return (
    <div
      className={`barra-carga relative h-[3px] w-full overflow-hidden bg-gray-20 ${className}`}
      role="progressbar"
      aria-label="Esperando"
    >
      <span className="absolute inset-y-0 left-0 block w-1/4 bg-ink" />
    </div>
  );
}

/** La tira de métricas mientras no hay números. */
export function EsqueletoTira({ celdas = 5 }: { celdas?: number }) {
  return (
    <div className="overflow-hidden border border-ink">
      <div className="-mr-px -mb-px flex flex-wrap">
        {Array.from({ length: celdas }, (_, i) => (
          <div
            key={i}
            className="min-w-[130px] flex-1 border-r border-b border-gray-20 px-4 py-3.5"
          >
            <Linea className="h-2.5 w-16" />
            <Linea className="mt-2.5 h-5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** El encabezado de sección: eyebrow, título y bajada. */
export function EsqueletoEncabezado() {
  return (
    <div className="mb-8">
      <Linea className="h-2.5 w-28" />
      <Linea className="mt-3 h-7 w-64" />
      <Linea className="mt-3 h-3 w-full max-w-[52ch]" />
    </div>
  );
}
