import { Bloque, Linea } from "./esqueleto";

/**
 * La tarjeta de cobro mientras se arma.
 *
 * Es la misma pantalla para la familia con cuenta (`/mi/pagar`) y para la que
 * entra por el link suelto (`/p`), y las dos tardan por lo mismo: el servidor
 * resuelve quién es, imputa el plan y recién ahí dibuja el QR — dos consultas
 * y un dibujo antes de poder pintar una línea.
 *
 * Va del alto que va a tener la tarjeta de verdad, así que cuando llegan los
 * datos no salta nada.
 */
export function EsqueletoCobro({ conVolver = false }: { conVolver?: boolean }) {
  return (
    <div
      className={`flex min-h-screen flex-col bg-paper-dimmer px-4 py-8 ${
        conVolver ? "" : "items-center justify-center"
      }`}
    >
      <div className="mx-auto w-full max-w-[380px]">
        {conVolver && <Linea className="h-3 w-36" />}

        <div
          className={`border border-ink bg-lienzo px-7 py-8 ${conVolver ? "mt-4" : ""}`}
        >
          <Linea className="h-2.5 w-48" />
          <Linea className="mt-2.5 h-5 w-40" />

          {/* El monto */}
          <Linea className="mt-5 h-9 w-44" />
          <Linea className="mt-2.5 h-3 w-56" />

          {/* El QR */}
          <div className="mt-6 aspect-square w-full border border-ink p-3">
            <Bloque className="h-full w-full" />
          </div>
          <Linea className="mx-auto mt-3 h-2.5 w-44" />

          {/* Alias y CVU */}
          <div className="mt-4 flex items-center justify-between border border-ink px-3 py-2.5">
            <Linea className="h-3 w-40" />
            <Linea className="h-2.5 w-14" />
          </div>
          <div className="mt-2 flex items-center justify-between px-1">
            <Linea className="h-2.5 w-48" />
            <Linea className="h-2.5 w-10" />
          </div>

          <Bloque className="mt-6 h-11 w-full" />
        </div>
      </div>
    </div>
  );
}
