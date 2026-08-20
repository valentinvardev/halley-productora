"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  IconoAlerta,
  IconoCruz,
  IconoGrupos,
  IconoImagen,
  IconoLista,
  IconoRegalo,
  IconoTilde,
} from "~/app/_components/iconos";
import {
  HALLEY_BOX,
  progresoBox,
  type Linea,
  type Parametros,
} from "~/app/_datos/presupuesto";
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

/** Cómo se listan las opciones: una debajo de otra, o en tarjetas. */
export type Vista = "lista" | "grilla";

/**
 * El interruptor entre las dos vistas.
 *
 * La lista es para leer: los textos completos, uno tras otro, y alcanza para
 * decidir cuando uno ya sabe qué quiere. La grilla es para comparar: varias
 * fotos a la vez —dos en el teléfono, tres en escritorio—, que es lo que sirve
 * cuando la decisión no está tomada y lo que la empuja no es el texto sino ver
 * el trabajo.
 *
 * Van los dos y no uno solo porque las dos preguntas son reales, y cuál es la
 * de cada persona no se sabe de antemano.
 */
export function SelectorVista({
  vista,
  alCambiar,
}: {
  vista: Vista;
  alCambiar: (v: Vista) => void;
}) {
  return (
    <div
      className="flex border border-gray-20"
      role="group"
      aria-label="Cómo ver las opciones"
    >
      {(
        [
          ["lista", "Lista", <IconoLista key="l" className="h-3.5 w-3.5" />],
          ["grilla", "Fotos", <IconoGrupos key="g" className="h-3.5 w-3.5" />],
        ] as const
      ).map(([valor, texto, icono]) => (
        <button
          key={valor}
          type="button"
          onClick={() => alCambiar(valor)}
          aria-pressed={vista === valor}
          className={`inline-flex cursor-pointer items-center gap-1.5 px-3 py-2 font-rotulo text-[11px] tracking-[0.06em] uppercase transition-colors ${
            vista === valor
              ? "bg-ink text-paper"
              : "text-gray-45 hover:text-ink"
          }`}
        >
          {icono}
          {texto}
        </button>
      ))}
    </div>
  );
}

/**
 * Una opción elegible.
 *
 * El `tipo` no cambia cómo se ve sino qué promete: una sola opción o varias.
 * Se refleja en el rol de accesibilidad y en la marca de la esquina —un punto
 * para lo excluyente, un tilde para lo acumulable— porque es la diferencia que
 * hay que poder ver antes de tocar, no después.
 *
 * En `grilla` la foto pasa al frente y ocupa el ancho de la tarjeta. Es el
 * mismo contenido con otra jerarquía: en lista se lee, en grilla se mira, y lo
 * que cambia es qué tiene que entrar primero por el ojo.
 */
export function Opcion({
  tipo,
  vista = "lista",
  elegida,
  alElegir,
  titulo,
  texto,
  precio,
  imagen,
  children,
}: {
  tipo: "una" | "varias";
  vista?: Vista;
  elegida: boolean;
  alElegir: () => void;
  titulo: string;
  texto: string;
  /** Sin precio no se muestra la línea: sirve para las locaciones sin extra. */
  precio?: ReactNode;
  /** La foto que cargó el panel, si el ítem tiene una. */
  imagen?: string;
  /** Lo que se despliega adentro al elegirla — las coberturas, las locaciones. */
  children?: ReactNode;
}) {
  const grilla = vista === "grilla";

  const marca = (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 shrink-0 items-center justify-center border transition-colors ${
        tipo === "una" ? "rounded-full" : ""
      } ${elegida ? "border-ink bg-ink text-paper" : "border-gray-45 bg-paper"}`}
    >
      {elegida &&
        (tipo === "una" ? (
          <span className="h-2 w-2 rounded-full bg-paper" />
        ) : (
          <IconoTilde className="h-3 w-3" />
        ))}
    </span>
  );

  return (
    <div
      className={`flex flex-col border transition-colors ${
        elegida ? "border-ink bg-paper-dim" : "border-gray-20 bg-paper"
      }`}
    >
      <button
        type="button"
        role={tipo === "una" ? "radio" : "checkbox"}
        aria-checked={elegida}
        onClick={alElegir}
        className={
          grilla
            ? "flex w-full flex-1 cursor-pointer flex-col text-left"
            : "flex w-full cursor-pointer items-start gap-4 p-5 text-left sm:p-6"
        }
      >
        {grilla ? (
          <>
            {/* La foto manda. Sin foto queda el hueco igual: una grilla donde
                unas tarjetas miden una cosa y otras miden otra se lee como algo
                roto, y el hueco además invita a cargarla. */}
            {/* Dos por uno y no cuatro por tres. La grilla existe para
                comparar de a cuatro, y con la foto más alta entraba una fila y
                media: la segunda quedaba abajo del pliegue, que es justo lo que
                la vista venía a resolver. */}
            <span className="relative block aspect-[2/1] w-full overflow-hidden bg-paper-dim">
              {imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagen}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-gray-45">
                  <IconoImagen className="h-5 w-5" />
                </span>
              )}
              <span className="absolute top-2.5 left-2.5">{marca}</span>
            </span>

            <span className="flex flex-1 flex-col p-4">
              <span className="font-titulo text-[clamp(1.05rem,2.2vw,1.35rem)] leading-tight uppercase">
                {titulo}
              </span>
              <span className="mt-1.5 block text-[13px] leading-snug text-gray-70">
                {texto}
              </span>
              {precio !== undefined && (
                <span className="mt-3 block text-[14px] tabular-nums">
                  {precio}
                </span>
              )}
            </span>
          </>
        ) : (
          <>
            {/* La marca de estado. El cuadrado es acumulable, el círculo
                excluyente: es la convención de cualquier formulario y no hay
                razón para reinventarla acá. */}
            <span className="mt-0.5">{marca}</span>

            {/* La foto va chica y al costado, no de fondo: detrás del texto
                obliga a poner un velo encima, y un velo sobre una foto de
                trabajo la apaga justo donde tenía que convencer. */}
            {imagen && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imagen}
                alt=""
                loading="lazy"
                decoding="async"
                className="hidden h-[76px] w-[76px] shrink-0 border border-gray-20 object-cover sm:block"
              />
            )}

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-titulo text-[clamp(1.15rem,2.6vw,1.5rem)] leading-tight uppercase">
                  {titulo}
                </span>
                {precio !== undefined && (
                  <span className="text-[15px] tabular-nums whitespace-nowrap">
                    {precio}
                  </span>
                )}
              </span>
              <span className="mt-2 block max-w-[54ch] text-[14px] leading-relaxed text-gray-70">
                {texto}
              </span>
            </span>
          </>
        )}
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
export function BarraBox({
  total,
  parametros,
}: {
  total: number;
  parametros: Parametros;
}) {
  const { falta, abierta, parte } = progresoBox(total, parametros);

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
            className={`flex items-baseline justify-between gap-4 py-2.5 ${
              // Las coberturas cuelgan del momento de arriba: van corridas y
              // más chicas, que es lo que dice "esto es parte de aquello" sin
              // tener que escribirlo.
              l.bajo ? "pl-4 text-gray-70" : ""
            }`}
          >
            <span
              className={`min-w-0 ${l.bajo ? "text-[13px]" : "text-[14px]"}`}
            >
              {l.bajo && <span aria-hidden="true">· </span>}
              {l.nombre}
              {l.detalle && (
                <span className="block text-[12.5px] text-gray-45">
                  {l.detalle}
                </span>
              )}
            </span>
            <span className="text-[14px] tabular-nums whitespace-nowrap">
              {pesos(l.precio)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-baseline justify-between gap-4 pt-3">
        <span className="font-rotulo text-[11.5px] tracking-[0.08em] uppercase">
          Total
        </span>
        <span className="text-[19px] font-medium tabular-nums">
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
  acciones,
}: {
  rotulo: string;
  titulo: string;
  bajada?: string;
  /** Va arriba a la derecha: el interruptor de vista, hoy. */
  acciones?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <div className="flex items-start justify-between gap-4">
        <p className="font-rotulo text-[11.5px] tracking-[0.22em] text-gray-70 uppercase">
          {rotulo}
        </p>
        {acciones}
      </div>
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

/* ------------------------------------------------------------------- aviso */

/**
 * El reclamo de lo que falta, en una tarjeta que aparece sobre el pie.
 *
 * Antes era una franja que se insertaba adentro del pie, y eso tenía un
 * problema de fondo: al aparecer empujaba los botones hacia abajo, justo en el
 * momento en que la persona acababa de apretar uno. El dedo ya estaba ahí y el
 * botón se le movía. Flotando encima no mueve nada.
 *
 * Se va solo a los cinco segundos. Un reclamo que se queda después de resuelto
 * deja de leerse como una respuesta a lo que acabás de hacer y pasa a ser una
 * advertencia permanente, que es lo que la gente aprende a ignorar.
 *
 * El texto se guarda aparte del que llega por props: mientras la tarjeta se va,
 * el mensaje ya es `null`, y sin esa copia el cartel se vaciaría a mitad de la
 * animación de salida y lo último que se vería sería una tarjeta en blanco.
 */
export function AvisoFlotante({
  mensaje,
  alCerrar,
}: {
  mensaje: string | null;
  /** Tiene que ser estable: si cambia en cada pintado, el reloj se reinicia. */
  alCerrar: () => void;
}) {
  const [ultimo, setUltimo] = useState<string | null>(mensaje);

  useEffect(() => {
    if (mensaje) setUltimo(mensaje);
  }, [mensaje]);

  useEffect(() => {
    if (!mensaje) return;
    const reloj = setTimeout(alCerrar, 5000);
    return () => clearTimeout(reloj);
  }, [mensaje, alCerrar]);

  if (!ultimo) return null;

  return (
    <div
      className="aviso-flotante"
      data-visible={mensaje ? "si" : "no"}
      // `status` y no `alert`: interrumpir lo que el lector de pantalla está
      // diciendo, para algo que la persona provocó recién, molesta más de lo
      // que ayuda.
      role="status"
      aria-live="polite"
    >
      <div className="aviso-tarjeta">
        <IconoAlerta className="mt-px h-4 w-4 shrink-0" />
        <p className="min-w-0 flex-1 text-[13px] leading-snug">{ultimo}</p>
        <button
          type="button"
          onClick={alCerrar}
          aria-label="Cerrar aviso"
          className="-m-1 cursor-pointer p-1 text-gray-45 hover:text-ink"
        >
          <IconoCruz className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
