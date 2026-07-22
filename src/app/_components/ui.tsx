import type { ComponentProps, ReactNode } from "react";

/* -------------------------------------------------------------------------
   Componentes base del sistema de diseño: bordes de 1px, esquinas rectas,
   sin sombras. Los botones invierten ink/paper al hover, como un negativo.
------------------------------------------------------------------------- */

export const botonBase =
  "inline-flex items-center justify-center gap-2 border border-ink px-[22px] py-[13px] font-rotulo text-[13px] uppercase tracking-[0.04em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40";

export const botonSolido = `${botonBase} bg-ink text-paper hover:bg-paper hover:text-ink`;
export const botonFantasma = `${botonBase} bg-transparent text-ink hover:bg-ink hover:text-paper`;

export function Boton({
  variante = "solido",
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { variante?: "solido" | "fantasma" }) {
  const clases = variante === "solido" ? botonSolido : botonFantasma;
  return (
    <button className={`${clases} ${className}`} {...props}>
      {children}
    </button>
  );
}

/** Botón de texto subrayado, para acciones secundarias dentro de una fila. */
export function BotonTexto({
  className = "",
  children,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      className={`inline-flex cursor-pointer items-center gap-1.5 font-rotulo text-[11.5px] uppercase tracking-[0.05em] underline underline-offset-2 hover:text-gray-70 disabled:no-underline disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Etiqueta({ children }: { children: ReactNode }) {
  return (
    <span className="font-rotulo text-[11.5px] uppercase tracking-[0.06em] text-gray-70">
      {children}
    </span>
  );
}

export function Campo({
  label,
  hint,
  className = "",
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <Etiqueta>{label}</Etiqueta>
      <input
        className="border border-ink bg-lienzo px-3 py-[11px] text-[14px] placeholder:text-gray-45"
        {...props}
      />
      {hint && <span className="nota text-[11.5px] text-gray-45">{hint}</span>}
    </label>
  );
}

export function CampoTexto({
  label,
  hint,
  className = "",
  ...props
}: ComponentProps<"textarea"> & { label: string; hint?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <Etiqueta>{label}</Etiqueta>
      <textarea
        className="border border-ink bg-lienzo px-3 py-[11px] font-mono text-[13px] leading-relaxed placeholder:text-gray-45"
        {...props}
      />
      {hint && <span className="nota text-[11.5px] text-gray-45">{hint}</span>}
    </label>
  );
}

export function Tag({
  activo = false,
  children,
}: {
  activo?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block border border-ink px-2.5 py-1.5 font-rotulo text-[11.5px] uppercase tracking-[0.05em] ${
        activo ? "bg-ink text-paper" : "text-ink"
      }`}
    >
      {children}
    </span>
  );
}

/** Encabezado de sección: eyebrow + título + bajada. */
export function Encabezado({
  eyebrow,
  titulo,
  bajada,
  acciones,
}: {
  eyebrow: string;
  titulo: string;
  bajada?: string;
  acciones?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="eyebrow mb-2.5">{eyebrow}</div>
        <h2 className="text-[30px] leading-tight">{titulo}</h2>
        {bajada && (
          <p className="mt-1.5 max-w-[62ch] text-[14px] leading-relaxed text-gray-70">
            {bajada}
          </p>
        )}
      </div>
      {acciones && <div className="flex gap-3">{acciones}</div>}
    </div>
  );
}

/**
 * Tira de métricas: la caja que envuelve a los `Dato`.
 *
 * El problema que resuelve es el de siempre con `flex-wrap`: cuando los datos
 * se acomodan en dos filas, entre esas filas no queda ninguna línea y la tira
 * se lee como un bloque suelto. Acá cada dato trae borde derecho **y** de
 * abajo, y la fila interna se corre un píxel para afuera en las dos
 * direcciones; el `overflow-hidden` recorta lo que sobra del borde exterior.
 *
 * Así la grilla queda cerrada con cualquier cantidad de datos y en cualquier
 * ancho, sin saber de antemano dónde va a cortar.
 */
export function TiraDatos({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden border border-ink ${className}`}>
      <div className="-mr-px -mb-px flex flex-wrap">{children}</div>
    </div>
  );
}

/** Dato suelto con su rótulo arriba — va adentro de una `TiraDatos`. */
export function Dato({
  rotulo,
  valor,
  detalle,
  icono,
}: {
  rotulo: string;
  valor: ReactNode;
  detalle?: string;
  /** Va al lado del rótulo, del mismo color: acompaña, no compite. */
  icono?: ReactNode;
}) {
  return (
    <div className="min-w-[130px] flex-1 border-r border-b border-gray-20 px-4 py-3.5">
      <div className="flex items-center gap-1.5 font-rotulo text-[11.5px] uppercase tracking-[0.08em] text-gray-45">
        {icono}
        {rotulo}
      </div>
      <div className="mt-1 font-display text-[22px] leading-none">{valor}</div>
      {detalle && (
        <div className="mt-1.5 nota text-[11.5px]">{detalle}</div>
      )}
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return (
    <div className="nota border border-dashed border-gray-20 px-6 py-12 text-center text-gray-45">
      {children}
    </div>
  );
}
