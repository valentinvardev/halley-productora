"use client";

import { type ReactNode } from "react";

import { IconoRegalo, IconoTilde } from "~/app/_components/iconos";
import { HALLEY_BOX, progresoBox, type Linea } from "~/app/_datos/presupuesto";
import { pesos } from "~/lib/format";

/**
 * Las piezas del simulador.
 *
 * Todas hablan el mismo idioma que el resto de la marca: bordes de un píxel,
 * esquinas rectas, sin sombras, y el estado elegido invierte tinta y papel en
 * vez de pintarse de un color. La landing no tiene color de acento, así que un
 * "seleccionado" azul sería el único de todo el sitio.
 */

/* ---------------------------------------------------------------- progreso */

/**
 * Los puntos de arriba.
 *
 * Son botones y no adornos: se puede volver a cualquier paso ya recorrido
 * tocándolo. Adelantarse no, porque los pasos siguientes dependen de lo que se
 * elija en éste — pero volver a mirar lo que ya se contestó es lo primero que
 * uno quiere en un formulario largo.
 */
export function Progreso({
  cantidad,
  actual,
  maximo,
  alIr,
  etiquetas,
}: {
  cantidad: number;
  /** Base 1: el paso 0 (elegir evento) no tiene punto. */
  actual: number;
  /** Hasta dónde llegó: más allá de esto los puntos no se pueden tocar. */
  maximo: number;
  alIr: (paso: number) => void;
  etiquetas: string[];
}) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Progreso">
      {Array.from({ length: cantidad }, (_, i) => {
        const paso = i + 1;
        const recorrido = paso <= maximo;
        const esActual = paso === actual;

        return (
          <button
            key={paso}
            type="button"
            disabled={!recorrido}
            onClick={() => alIr(paso)}
            aria-label={`Paso ${paso}: ${etiquetas[i] ?? ""}`}
            aria-current={esActual ? "step" : undefined}
            className={`h-[3px] flex-1 transition-colors disabled:cursor-default ${
              esActual
                ? "bg-ink"
                : recorrido
                  ? "bg-gray-45 hover:bg-ink"
                  : "bg-gray-20"
            }`}
          />
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- tarjetas */

/**
 * Una opción elegible.
 *
 * El `tipo` no cambia cómo se ve sino qué promete: una sola opción o varias.
 * Se refleja en el rol de accesibilidad y en la marca de la esquina —un punto
 * para lo excluyente, un tilde para lo acumulable— porque es la diferencia que
 * hay que poder ver antes de tocar, no después.
 */
export function Opcion({
  tipo,
  elegida,
  alElegir,
  titulo,
  texto,
  precio,
  children,
}: {
  tipo: "una" | "varias";
  elegida: boolean;
  alElegir: () => void;
  titulo: string;
  texto: string;
  /** Sin precio no se muestra la línea: sirve para las locaciones sin extra. */
  precio?: ReactNode;
  /** Lo que se despliega adentro al elegirla — hoy, las locaciones del book. */
  children?: ReactNode;
}) {
  return (
    <div
      className={`border transition-colors ${
        elegida ? "border-ink bg-paper-dim" : "border-gray-20 bg-paper"
      }`}
    >
      <button
        type="button"
        role={tipo === "una" ? "radio" : "checkbox"}
        aria-checked={elegida}
        onClick={alElegir}
        className="flex w-full cursor-pointer items-start gap-4 p-5 text-left sm:p-6"
      >
        {/* La marca de estado. El cuadrado es acumulable, el círculo excluyente:
            es la convención de cualquier formulario y no hay razón para
            reinventarla acá. */}
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border transition-colors ${
            tipo === "una" ? "rounded-full" : ""
          } ${elegida ? "border-ink bg-ink text-paper" : "border-gray-45"}`}
        >
          {elegida &&
            (tipo === "una" ? (
              <span className="h-2 w-2 rounded-full bg-paper" />
            ) : (
              <IconoTilde className="h-3 w-3" />
            ))}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="font-titulo text-[clamp(1.15rem,2.6vw,1.5rem)] leading-tight uppercase">
              {titulo}
            </span>
            {precio !== undefined && (
              <span className="font-display text-[15px] tabular-nums whitespace-nowrap">
                {precio}
              </span>
            )}
          </span>
          <span className="mt-2 block max-w-[54ch] text-[14px] leading-relaxed text-gray-70">
            {texto}
          </span>
        </span>
      </button>

      {children}
    </div>
  );
}

/* -------------------------------------------------------------- Halley Box */

/**
 * La barra de la Halley Box.
 *
 * Vive en el pie, encima del total, y se llena mientras se elige. Es el único
 * elemento del simulador que empuja a sumar, así que se lo mantiene chico y
 * callado: una línea que crece y una frase. Cuando se cruza el umbral cambia de
 * texto y la línea queda entera.
 *
 * No dice qué hay adentro. Una caja sorpresa enumerada es un combo.
 */
export function BarraBox({ total }: { total: number }) {
  const { falta, abierta, parte } = progresoBox(total);

  return (
    <div className="border-b border-gray-20 px-4 py-2 sm:px-6">
      <div className="mx-auto flex max-w-[1140px] items-center gap-3">
        <IconoRegalo
          className={`h-4 w-4 shrink-0 ${abierta ? "text-ink" : "text-gray-45"}`}
        />

        <div className="min-w-0 flex-1">
          <p className="truncate font-rotulo text-[11px] tracking-[0.08em] uppercase">
            {abierta ? (
              <>
                {HALLEY_BOX.nombre} desbloqueada
                <span className="ml-2 normal-case tracking-normal text-gray-45">
                  {HALLEY_BOX.desbloqueada}
                </span>
              </>
            ) : (
              <>
                Te faltan {pesos(falta)} para tu {HALLEY_BOX.nombre}
              </>
            )}
          </p>

          <div className="mt-1.5 h-[3px] w-full bg-gray-20">
            <div
              className="h-full bg-ink transition-[width] duration-500 ease-out"
              style={{ width: `${parte * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- detalle */

/** El desglose: una línea por ítem elegido, con su precio. */
export function Detalle({
  lineas,
  total,
  className = "",
}: {
  lineas: Linea[];
  total: number;
  className?: string;
}) {
  if (lineas.length === 0) {
    return (
      <p className={`nota text-[13px] ${className}`}>
        Todavía no elegiste nada.
      </p>
    );
  }

  return (
    <div className={className}>
      <ul className="divide-y divide-gray-20 border-y border-gray-20">
        {lineas.map((l) => (
          <li
            key={l.id}
            className="flex items-baseline justify-between gap-4 py-2.5"
          >
            <span className="min-w-0 text-[14px]">
              {l.nombre}
              {l.detalle && (
                <span className="block text-[12.5px] text-gray-45">
                  {l.detalle}
                </span>
              )}
            </span>
            <span className="font-display text-[14px] tabular-nums whitespace-nowrap">
              {pesos(l.precio)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-baseline justify-between gap-4 pt-3">
        <span className="font-rotulo text-[11.5px] tracking-[0.08em] uppercase">
          Total
        </span>
        <span className="font-display text-[19px] tabular-nums">
          {pesos(total)}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- encabezado */

/** El encabezado de cada paso: rótulo chico, título grande, bajada. */
export function Cabecera({
  rotulo,
  titulo,
  bajada,
}: {
  rotulo: string;
  titulo: string;
  bajada?: string;
}) {
  return (
    <header className="mb-8">
      <p className="font-rotulo text-[11.5px] tracking-[0.22em] text-gray-70 uppercase">
        {rotulo}
      </p>
      <h2 className="mt-3 max-w-[20ch] font-titulo text-[clamp(1.8rem,5vw,3rem)] leading-[0.94] uppercase">
        {titulo}
      </h2>
      {bajada && (
        <p className="mt-4 max-w-[56ch] text-[14.5px] leading-relaxed text-gray-70">
          {bajada}
        </p>
      )}
    </header>
  );
}
