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

/* ------------------------------------------------------------------ contacto */

/** WhatsApp: el globo con el tubo. */
export function IconoWhatsApp(props: Props) {
  return (
    <Svg {...props}>
      <path
        d="M2 14 L3.1 10.6 A6 6 0 1 1 5.4 12.9 Z"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M6.1 6 C6.1 8.4 7.6 9.9 10 9.9 L10.5 8.9 L9.2 8.3 L8.6 9 C8 8.7 7.3 8 7 7.4 L7.7 6.8 L7.1 5.5 Z"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  );
}

/** Instagram. */
export function IconoInstagram(props: Props) {
  return (
    <Svg {...props}>
      <rect x="2" y="2" width="12" height="12" rx="3.2" />
      <circle cx="8" cy="8" r="3" />
      <path d="M11.4 4.6 L11.5 4.6" />
    </Svg>
  );
}

/** Seguir leyendo / ir a. */
export function IconoFlecha(props: Props) {
  return (
    <Svg {...props}>
      <path d="M2.5 8 L13.5 8" />
      <path d="M9.5 3.5 L14 8 L9.5 12.5" />
    </Svg>
  );
}

/** Bajar: el indicador del hero. */
export function IconoBajar(props: Props) {
  return (
    <Svg {...props}>
      <path d="M8 2.5 L8 13.5" />
      <path d="M3.5 9 L8 13.5 L12.5 9" />
    </Svg>
  );
}

/** Reproducir: rotula los huecos de multimedia. */
export function IconoReproducir(props: Props) {
  return (
    <Svg {...props}>
      <path d="M4.5 2.5 L13 8 L4.5 13.5 Z" strokeLinejoin="round" />
    </Svg>
  );
}

/* --------------------------------------------------- rótulos de las métricas */

/** Recaudado: el billete. */
export function IconoBillete(props: Props) {
  return (
    <Svg {...props}>
      <rect x="1.5" y="4" width="13" height="8" />
      <circle cx="8" cy="8" r="1.9" />
      <path d="M3.6 8 L3.7 8" />
      <path d="M12.3 8 L12.4 8" />
    </Svg>
  );
}

/** Plan total: lo que se espera juntar. */
export function IconoObjetivo(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.4" />
    </Svg>
  );
}

/** Con saldo: todavía falta, pero no venció. */
export function IconoReloj(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.3 L8 8 L10.7 9.6" />
    </Svg>
  );
}

/** Con vencidas: lo que ya pasó de fecha. */
export function IconoAlerta(props: Props) {
  return (
    <Svg {...props}>
      <path d="M8 1.8 L15 13.8 L1 13.8 Z" strokeLinejoin="round" />
      <path d="M8 6 L8 9.6" />
      <path d="M8 11.6 L8 11.7" />
    </Svg>
  );
}

/** Plan de cuotas: el calendario del vencimiento. */
export function IconoCalendario(props: Props) {
  return (
    <Svg {...props}>
      <rect x="1.5" y="3" width="13" height="11.5" />
      <path d="M1.5 6.5 L14.5 6.5" />
      <path d="M4.8 1.5 L4.8 4" />
      <path d="M11.2 1.5 L11.2 4" />
    </Svg>
  );
}

/* ------------------------------------------------------------------ acciones */

/** Recordatorio a una familia puntual. */
export function IconoCampana(props: Props) {
  return (
    <Svg {...props}>
      <path d="M3.5 12 L3.5 7 A4.5 4.5 0 0 1 12.5 7 L12.5 12 L14 12 L14 13 L2 13 L2 12 Z" />
      <path d="M6.5 13 A1.6 1.6 0 0 0 9.5 13" />
    </Svg>
  );
}

/** Eliminar. */
export function IconoPapelera(props: Props) {
  return (
    <Svg {...props}>
      <path d="M2.5 4 L13.5 4" />
      <path d="M6 4 L6 2.5 L10 2.5 L10 4" />
      <path d="M4 4 L4.7 13.5 L11.3 13.5 L12 4" />
      <path d="M6.6 6.5 L6.9 11" />
      <path d="M9.4 6.5 L9.1 11" />
    </Svg>
  );
}

/** Simulación: la probeta del modo demo. */
export function IconoProbeta(props: Props) {
  return (
    <Svg {...props}>
      <path d="M6.5 2 L6.5 6.5 L3 13 L13 13 L9.5 6.5 L9.5 2" />
      <path d="M5.5 2 L10.5 2" />
      <path d="M4.8 10 L11.2 10" />
    </Svg>
  );
}

/** Galería bloqueada hasta saldar. */
export function IconoCandado(props: Props) {
  return (
    <Svg {...props}>
      <rect x="3" y="7" width="10" height="7" rx="1" />
      <path d="M5 7 V5 A3 3 0 0 1 11 5 V7" />
      <path d="M8 9.5 L8 11.5" />
    </Svg>
  );
}

/** Navegación en pantallas chicas. */
export function IconoHamburguesa(props: Props) {
  return (
    <Svg {...props}>
      <path d="M1.5 4 L14.5 4" />
      <path d="M1.5 8 L14.5 8" />
      <path d="M1.5 12 L14.5 12" />
    </Svg>
  );
}

/** La cuenta con la que se está adentro. */
export function IconoPerfil(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="5.6" r="2.9" strokeWidth={1.3} />
      <path d="M2.4 14 A5.6 5.6 0 0 1 13.6 14" strokeWidth={1.3} />
    </Svg>
  );
}

/** Menú de acciones: la elipsis. */
export function IconoPuntos(props: Props) {
  return (
    <Svg {...props}>
      <path d="M3.5 8 L3.6 8" />
      <path d="M8 8 L8.1 8" />
      <path d="M12.5 8 L12.6 8" />
    </Svg>
  );
}

/**
 * Sol y luna del botón de tema.
 *
 * Trazo un punto más fino que el resto: son formas cerradas y con 1.5 se
 * empastan a 16px.
 */
export function IconoSol(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="3.1" strokeWidth={1.3} />
      <g strokeWidth={1.3}>
        <path d="M8 0.8 L8 2.6" />
        <path d="M8 13.4 L8 15.2" />
        <path d="M0.8 8 L2.6 8" />
        <path d="M13.4 8 L15.2 8" />
        <path d="M2.9 2.9 L4.2 4.2" />
        <path d="M11.8 11.8 L13.1 13.1" />
        <path d="M13.1 2.9 L11.8 4.2" />
        <path d="M4.2 11.8 L2.9 13.1" />
      </g>
    </Svg>
  );
}

export function IconoLuna(props: Props) {
  return (
    <Svg {...props}>
      {/* Un solo trazo: el creciente sale del recorte de dos círculos. */}
      <path
        d="M13.2 9.9 A6 6 0 1 1 6.1 2.8 A4.7 4.7 0 0 0 13.2 9.9 Z"
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Cerrar. */
export function IconoCruz(props: Props) {
  return (
    <Svg {...props}>
      <path d="M3.5 3.5 L12.5 12.5" />
      <path d="M12.5 3.5 L3.5 12.5" />
    </Svg>
  );
}

/** Volver: la flecha hacia atrás. */
export function IconoVolver(props: Props) {
  return (
    <Svg {...props}>
      <path d="M13.5 8 L2.5 8" />
      <path d="M6.5 3.5 L2 8 L6.5 12.5" />
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
