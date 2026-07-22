import type { Metadata } from "next";
import Link from "next/link";
import { Bebas_Neue, Montserrat } from "next/font/google";

import { Logotipo } from "./_components/logotipo";
import { NavPublica } from "./_components/nav-publica";
import { botonFantasma, botonSolido } from "./_components/ui";

export const metadata: Metadata = {
  title: "Halley Audiovisual — Productora en Córdoba",
  description:
    "Dron, fotografía y video para egresados, bodas, quince años y marcas. Los momentos son fugaces: Halley los hace eternos.",
};

/**
 * Las tipografías de la marca se cargan acá y no en el layout raíz: sólo las
 * usa esta ruta, y no tiene sentido que el panel se baje dos familias que no
 * va a pintar.
 */
const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bebas",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-montserrat",
});

const SECCIONES = [
  { href: "#servicios", texto: "Servicios" },
  { href: "#como", texto: "Cómo trabajamos" },
  { href: "#contacto", texto: "Contacto" },
];

/** El teléfono va una sola vez y de acá salen todos los enlaces. */
const WHATSAPP = "5493513000000";
const INSTAGRAM = "https://instagram.com/halley.audiovisual";
const MAIL = "hola@halleyaudiovisual.com";

const linkWhatsApp = (mensaje: string) =>
  `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;

const SERVICIOS = [
  {
    id: "egresados",
    nombre: "Egresados",
    linea: "El último año, de la previa al último tema.",
    detalle:
      "Cobertura del evento con dron, fotos y video editado. El curso contrata una vez y cada familia paga su cuota desde su propio panel.",
  },
  {
    id: "bodas",
    nombre: "Bodas",
    linea: "Desde los preparativos hasta que se apaga la música.",
    detalle:
      "Dos miradas en simultáneo, tomas aéreas y el video que se mira entero, no de a fragmentos.",
  },
  {
    id: "quince",
    nombre: "Quince años",
    linea: "La sesión previa, la entrada, el vals.",
    detalle:
      "Producción de la sesión con la quinceañera y cobertura completa de la fiesta, con el material listo para compartir.",
  },
  {
    id: "marcas",
    nombre: "Marcas",
    linea: "Publicidad, institucional, recitales y contenido para redes.",
    detalle:
      "Piezas pensadas para dónde se van a ver: un spot no se corta igual para una pantalla que para un teléfono.",
  },
];

const NO_NEGOCIABLES = [
  {
    titulo: "Cercanía con oficio",
    texto:
      "Trabajás con la persona especializada en tu tipo de evento, que además va a estar el día de la cobertura. No hay intermediarios ni distancia de empresa.",
  },
  {
    titulo: "Cámaras Sony, todo el equipo igual",
    texto:
      "El mismo estándar técnico en cada cámara y cada persona, sin excepciones. Trabajamos al 100% de nuestra capacidad técnica o no lo hacemos.",
  },
  {
    titulo: "Innovación constante",
    texto:
      "Miramos lo que se está haciendo y lo que se viene, para llegar a tu evento con algo más que el año pasado.",
  },
  {
    titulo: "Nos encontrás",
    texto:
      "Por WhatsApp, por redes o en la oficina. Preguntar algo no debería llevar tres días.",
  },
];

export default function Landing() {
  return (
    <div className={`landing ${bebas.variable} ${montserrat.variable}`}>
      <NavPublica secciones={SECCIONES} />

      <Hero />
      <Concepto />
      <Servicios />
      <Como />
      <Contacto />
      <Pie />
    </div>
  );
}

/* --------------------------------------------------------------------- hero */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-gray-20">
      <Estela />

      <div className="relative mx-auto max-w-[1140px] px-6 pt-20 pb-16 sm:px-10 sm:pt-28 sm:pb-24">
        <p className="font-rotulo text-[12.5px] uppercase tracking-[0.22em] text-gray-70">
          Córdoba · Dron, fotografía y video
        </p>

        {/* El titular es el eslogan del manual, tal cual. */}
        <h1 className="mt-7 font-titulo text-[clamp(3.4rem,12vw,9.5rem)] leading-[0.86] tracking-[0.005em] uppercase">
          Los momentos
          <br />
          son fugaces.
          <br />
          <span className="text-gray-70">Halley los hace eternos.</span>
        </h1>

        <p className="mt-9 max-w-[52ch] text-[15.5px] leading-relaxed text-gray-70">
          Somos una productora audiovisual de Córdoba. Cubrimos egresados,
          bodas, quince años y marcas. El día pasa una sola vez: nos ocupamos de
          que puedas volver.
        </p>

        <div className="mt-10 flex flex-wrap gap-3.5">
          <a
            href={linkWhatsApp("Hola Halley, quiero pedir un presupuesto.")}
            target="_blank"
            rel="noreferrer"
            className={botonSolido}
          >
            Pedir presupuesto
          </a>
          <a href="#servicios" className={botonFantasma}>
            Ver servicios
          </a>
        </div>
      </div>
    </section>
  );
}

/**
 * La estela del cometa, detrás del titular.
 *
 * Se dibuja una sola vez al cargar y no vuelve a correr. Es el concepto de la
 * marca hecho comportamiento: lo que pasa una vez no se repite. Un loop diría
 * exactamente lo contrario.
 */
function Estela() {
  return (
    <svg
      className="pointer-events-none absolute -top-24 -right-24 h-[520px] w-[900px] max-w-none opacity-[0.5] sm:opacity-100"
      viewBox="0 0 900 520"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M-40 500 C 240 470, 520 330, 700 120 C 760 50, 800 20, 860 0"
        stroke="var(--color-gray-20)"
        strokeWidth="1.25"
        className="estela"
      />
      <path
        d="M-40 520 C 300 500, 560 380, 760 150"
        stroke="var(--color-gray-20)"
        strokeWidth="1"
        className="estela"
      />
    </svg>
  );
}

/* ----------------------------------------------------------------- concepto */

function Concepto() {
  return (
    <section className="border-b border-gray-20">
      <div className="mx-auto grid max-w-[1140px] gap-10 px-6 py-20 sm:px-10 sm:py-28 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <h2 className="font-titulo text-[clamp(2.2rem,5.5vw,4.2rem)] leading-[0.94] uppercase">
          Hay quien lo ve una vez en la vida.
          <br />
          <span className="text-gray-70">Con suerte, dos.</span>
        </h2>

        <div className="max-w-[54ch] space-y-5 text-[15px] leading-relaxed text-gray-70">
          <p>
            El cometa Halley orbita el Sol y se ve desde la Tierra cada 75 años.
            Es historia viva de la astronomía, pero para dejarse ver pide algo
            simple: estar ahí, atentos, en el momento justo.
          </p>
          <p>
            De eso se trata nuestro trabajo. Captamos lo que no se repite —esa
            mirada, ese abrazo, esa emoción—, y cuando queda registrado en el
            instante preciso deja de ser sólo un recuerdo: se vuelve un punto de
            regreso.
          </p>
          <p className="text-ink">
            La posibilidad de volver a sentir, de volver a mirar, de volver a
            abrazar.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- servicios */

/**
 * Las bandas.
 *
 * El manual presenta los servicios como franjas horizontales apiladas, no como
 * tarjetas: se usa ese mismo gesto. Cada banda se invierte al pasarle por
 * encima —el crema de la marca pasa a ser el fondo—, que es todo el
 * movimiento que hace falta.
 */
function Servicios() {
  return (
    <section id="servicios" className="border-b border-gray-20">
      <div className="mx-auto max-w-[1140px] px-6 pt-20 sm:px-10 sm:pt-28">
        <p className="font-rotulo text-[12.5px] uppercase tracking-[0.22em] text-gray-70">
          Qué hacemos
        </p>
        <h2 className="mt-4 max-w-[18ch] font-titulo text-[clamp(2.4rem,7vw,5.5rem)] leading-[0.9] uppercase">
          Cuatro tipos de día
        </h2>
      </div>

      <div className="mt-14 border-t border-gray-20">
        {SERVICIOS.map((s) => (
          <a
            key={s.id}
            href="#contacto"
            className="group block border-b border-gray-20 transition-colors duration-300 hover:bg-paper-dimmer focus-visible:bg-paper-dimmer"
          >
            <div className="mx-auto flex max-w-[1140px] flex-col gap-4 px-6 py-9 sm:px-10 sm:py-11 lg:flex-row lg:items-baseline lg:gap-12">
              <h3 className="font-titulo text-[clamp(2.4rem,6.5vw,4.6rem)] leading-[0.86] uppercase lg:w-[38%] lg:shrink-0">
                {s.nombre}
              </h3>

              <div className="lg:flex-1">
                <p className="text-[16px] leading-snug">{s.linea}</p>
                <p className="mt-2.5 max-w-[56ch] text-[14px] leading-relaxed text-gray-70">
                  {s.detalle}
                </p>
              </div>

              <span className="font-rotulo text-[12.5px] uppercase tracking-[0.12em] text-gray-45 transition-colors group-hover:text-ink">
                Consultar →
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- cómo */

function Como() {
  return (
    <section id="como" className="border-b border-gray-20">
      <div className="mx-auto max-w-[1140px] px-6 py-20 sm:px-10 sm:py-28">
        <p className="font-rotulo text-[12.5px] uppercase tracking-[0.22em] text-gray-70">
          Cómo trabajamos
        </p>
        <h2 className="mt-4 max-w-[20ch] font-titulo text-[clamp(2.2rem,6vw,4.6rem)] leading-[0.9] uppercase">
          Lo que no negociamos
        </h2>

        {/* Cuatro cosas que sostenemos a la vez, no cuatro pasos: por eso no
            van numeradas. */}
        <div className="mt-12 grid gap-px border border-gray-20 bg-gray-20 sm:grid-cols-2">
          {NO_NEGOCIABLES.map((n) => (
            <div key={n.titulo} className="bg-paper p-7 sm:p-9">
              <h3 className="font-titulo text-[clamp(1.5rem,3vw,2.1rem)] leading-tight uppercase">
                {n.titulo}
              </h3>
              <p className="mt-3 max-w-[46ch] text-[14.5px] leading-relaxed text-gray-70">
                {n.texto}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- contacto */

function Contacto() {
  return (
    <section id="contacto" className="border-b border-gray-20">
      <div className="mx-auto grid max-w-[1140px] gap-12 px-6 py-20 sm:px-10 sm:py-28 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <h2 className="max-w-[16ch] font-titulo text-[clamp(2.6rem,8vw,6rem)] leading-[0.88] uppercase">
            Contanos qué día es
          </h2>
          <p className="mt-6 max-w-[48ch] text-[15.5px] leading-relaxed text-gray-70">
            Escribinos la fecha y el tipo de evento. Te respondemos con una
            propuesta y, si querés, nos juntamos a verla.
          </p>

          <div className="mt-9 flex flex-wrap gap-3.5">
            <a
              href={linkWhatsApp("Hola Halley, quiero consultar por un evento.")}
              target="_blank"
              rel="noreferrer"
              className={botonSolido}
            >
              Escribir por WhatsApp
            </a>
            <a
              href={INSTAGRAM}
              target="_blank"
              rel="noreferrer"
              className={botonFantasma}
            >
              Ver el Instagram
            </a>
          </div>

          <p className="mt-7 font-mono text-[12px] text-gray-45">{MAIL}</p>
        </div>

        {/* El puente con el producto: quien ya contrató entra por acá. */}
        <div className="border border-ink p-7 lg:max-w-[340px]">
          <p className="font-rotulo text-[12px] uppercase tracking-[0.14em] text-gray-45">
            Ya sos cliente
          </p>
          <p className="mt-3 text-[14.5px] leading-relaxed">
            Si tu curso ya contrató a Halley, seguí las cuotas y bajá tu galería
            desde tu panel.
          </p>
          <Link
            href="/entrar"
            className="mt-5 inline-block font-rotulo text-[13px] uppercase tracking-[0.08em] underline underline-offset-4 hover:text-gray-70"
          >
            Entrar a mi panel
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- pie */

function Pie() {
  return (
    <footer className="mx-auto max-w-[1140px] px-6 py-12 sm:px-10">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <Logotipo variante="isologo" className="h-20" />

        <div className="text-right">
          <p className="font-rotulo text-[12px] uppercase tracking-[0.14em] text-gray-45">
            Halley Audiovisual · Córdoba, Argentina
          </p>
          <p className="mt-2 font-mono text-[10.5px] tracking-[0.1em] text-gray-45">
            HALLEY × SURCODIA — 026
          </p>
        </div>
      </div>
    </footer>
  );
}
