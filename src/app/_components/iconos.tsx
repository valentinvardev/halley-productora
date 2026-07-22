/**
 * Íconos de acción.
 *
 * Trazo de 1.5, esquinas rectas y sin relleno, para que convivan con los
 * bordes de 1px del sistema. Van en `currentColor`: se invierten solos cuando
 * el botón pasa a negativo al hover y cuando la página cambia a modo oscuro.
 *
 * Ojo: no son las marcas de lápiz graso (círculo, tilde, cruz). Aquéllas
 * comunican estado y viven en `marca.tsx`; éstos sólo rotulan un botón.
 */

type Props = { className?: string };

function Svg({ children, className = "h-3.5 w-3.5" }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Invitación: sobre cerrado. */
export function IconoSobre(props: Props) {
  return (
    <Svg {...props}>
      <rect x="1.5" y="3.5" width="13" height="9" />
      <path d="M1.5 4.5 L8 9 L14.5 4.5" />
    </Svg>
  );
}

/** Recordatorio: el mismo sobre, con la flecha de volver a enviar. */
export function IconoSobreReenvio(props: Props) {
  return (
    <Svg {...props}>
      <rect x="1.5" y="5.5" width="11" height="8" />
      <path d="M1.5 6.5 L7 10 L12.5 6.5" />
      <path d="M10.5 3 A3 3 0 1 1 13.5 6" />
      <path d="M13.5 3.2 L13.5 6 L10.7 6" />
    </Svg>
  );
}

/** Copiar: la hoja de atrás y la de adelante. */
export function IconoCopiar(props: Props) {
  return (
    <Svg {...props}>
      <rect x="5.5" y="5.5" width="9" height="9" />
      <path d="M11 3.5 L2.5 3.5 L2.5 11" />
    </Svg>
  );
}

/** Confirmación breve de una acción (no es la marca de pago). */
export function IconoTilde(props: Props) {
  return (
    <Svg {...props}>
      <path d="M2.5 8.5 L6 12 L13.5 4" />
    </Svg>
  );
}

/** Agregar de a uno. */
export function IconoMas(props: Props) {
  return (
    <Svg {...props}>
      <path d="M8 2.5 L8 13.5" />
      <path d="M2.5 8 L13.5 8" />
    </Svg>
  );
}

/** Carga en bloque: una lista pegada. */
export function IconoLista(props: Props) {
  return (
    <Svg {...props}>
      <path d="M1.5 4 L2.5 4" />
      <path d="M1.5 8 L2.5 8" />
      <path d="M1.5 12 L2.5 12" />
      <path d="M5 4 L14.5 4" />
      <path d="M5 8 L14.5 8" />
      <path d="M5 12 L14.5 12" />
    </Svg>
  );
}
