/**
 * Las marcas de lápiz graso del sistema de diseño. La misma gramática se usa
 * para el estado de cobro (circulado = pagado, punteado = pendiente, tachado =
 * vencido) y para curar el portfolio.
 *
 * El corazón es la excepción: marca las fotos que el prospecto likea y es el
 * único elemento con color de todo el sistema.
 */

const CIRCULO =
  "M30 6 C44 6 52 16 51 30 C50 44 40 53 28 52 C14 51 7 40 8 27 C9 14 18 5 30 6";

/** Tilde a mano alzada, contenido dentro del círculo. */
const TILDE = "M19 30 C22 33 24.5 36 26.5 39 C31 31 36 24 42 19";

const CORAZON =
  "M30 51 C30 51 8 37 8 22 C8 13.5 14.5 8 21.5 8 C25.8 8 29 10.3 30 13.2 C31 10.3 34.2 8 38.5 8 C45.5 8 52 13.5 52 22 C52 37 30 51 30 51 Z";

export type TipoMarca =
  /** Círculo con tilde: pago confirmado. */
  | "confirmado"
  /** Círculo solo: seleccionado (curaduría del portfolio). */
  | "circulado"
  | "punteado"
  | "tachado"
  | "corazon";

export function Marca({
  tipo,
  className = "h-5 w-5",
  color = "currentColor",
  grosor = 4,
  animar = false,
}: {
  tipo: TipoMarca;
  className?: string;
  color?: string;
  grosor?: number;
  animar?: boolean;
}) {
  const trazo = animar ? "marca-anim" : undefined;

  return (
    <svg
      viewBox="0 0 60 60"
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ overflow: "visible" }}
    >
      {(tipo === "circulado" || tipo === "confirmado") && (
        <path
          d={CIRCULO}
          fill="none"
          stroke={color}
          strokeWidth={grosor}
          strokeLinecap="round"
          className={trazo}
        />
      )}

      {tipo === "confirmado" && (
        <path
          d={TILDE}
          fill="none"
          stroke={color}
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={animar ? "marca-anim-tilde" : undefined}
        />
      )}

      {tipo === "punteado" && (
        <path
          d={CIRCULO}
          fill="none"
          stroke={color}
          strokeWidth={grosor - 1}
          strokeDasharray="8 8"
          strokeLinecap="round"
        />
      )}

      {tipo === "tachado" && (
        <>
          <line
            x1="14"
            y1="14"
            x2="46"
            y2="46"
            stroke={color}
            strokeWidth={grosor}
            strokeLinecap="round"
          />
          <line
            x1="46"
            y1="14"
            x2="14"
            y2="46"
            stroke={color}
            strokeWidth={grosor}
            strokeLinecap="round"
          />
        </>
      )}

      {tipo === "corazon" && (
        <path
          d={CORAZON}
          fill="var(--color-marca)"
          fillOpacity={0.55}
          stroke="var(--color-marca)"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/** Estado de cobro con su marca correspondiente. */
export function EstadoCobro({
  estado,
  className = "",
}: {
  estado: "PENDIENTE" | "PAGADO" | "VENCIDO";
  className?: string;
}) {
  // Colores por variable: en negativo (modo oscuro) la tinta se invierte sola.
  const config = {
    PAGADO: {
      tipo: "confirmado",
      texto: "Pagado",
      color: "var(--color-ink)",
    },
    PENDIENTE: {
      tipo: "punteado",
      texto: "Pendiente",
      color: "var(--color-gray-45)",
    },
    VENCIDO: { tipo: "tachado", texto: "Vencido", color: "var(--color-ink)" },
  } as const;

  const { tipo, texto, color } = config[estado];

  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <span className="h-5 w-5 shrink-0">
        <Marca tipo={tipo} color={color} className="h-full w-full" />
      </span>
      <span className="text-[13.5px]">{texto}</span>
    </span>
  );
}
