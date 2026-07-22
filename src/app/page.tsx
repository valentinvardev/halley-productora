import type { Metadata } from "next";
import Link from "next/link";

import { FUENTES_MARCA } from "./_components/fuentes";
import {
  IconoBajar,
  IconoFlecha,
  IconoInstagram,
  IconoSobre,
  IconoWhatsApp,
} from "./_components/iconos";
import { Logotipo } from "./_components/logotipo";
import { Medio, existeEnPublico } from "./_components/medio";
import { NavPublica } from "./_components/nav-publica";
import { botonFantasma, botonSolido } from "./_components/ui";
import {
  INSTAGRAM,
  MAIL,
  SERVICIOS,
  linkWhatsApp,
} from "./_datos/servicios";

export const metadata: Metadata = {
  title: "Halley Audiovisual — Productora en Córdoba",
  description:
    "Dron, fotografía y video para egresados, bodas, quince años y marcas. Los momentos son fugaces: Halley los hace eternos.",
};

const SECCIONES = [
  { href: "#servicios", texto: "Servicios" },
  { href: "#como", texto: "Cómo trabajamos" },
  { href: "#contacto", texto: "Contacto" },
];

const VIDEO_PORTADA = "/portada/portada.mp4";
const POSTER_PORTADA = "/portada/portada.jpg";

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
    <div className={`landing ${FUENTES_MARCA}`}>
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
  const hayVideo = existeEnPublico(VIDEO_PORTADA);

  return (
    <section className="hero aisla relative flex flex-col justify-center overflow-hidden border-b border-gray-20">
      {hayVideo ? (
        <>
          <video
            src={VIDEO_PORTADA}
            poster={existeEnPublico(POSTER_PORTADA) ? POSTER_PORTADA : undefined}
            muted
            loop
            autoPlay
            playsInline
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Oscurece el fondo antes de la mezcla: con el video más parejo, la
              inversa del titular sale siempre del lado claro. */}
          <div
            className="absolute inset-0 bg-[rgb(0_0_0/0.42)]"
            aria-hidden="true"
          />
        </>
      ) : (
        <Estela />
      )}

      <div className="relative mx-auto w-full max-w-[1140px] px-6 sm:px-10">
        <div className="negativo">
          <p className="font-rotulo text-[12px] uppercase tracking-[0.22em] sm:text-[12.5px]">
            Córdoba · Dron, fotografía y video
          </p>

          {/* El titular es el eslogan del manual, tal cual. */}
          <h1 className="titular-hero mt-6">
            Los momentos
            <br />
            son fugaces.
            <br />
            Halley los hace eternos.
          </h1>

          <p className="mt-7 max-w-[48ch] text-[15px] leading-relaxed">
            Productora audiovisual de Córdoba. Egresados, bodas, quince años y
            marcas. El día pasa una sola vez: nos ocupamos de que puedas volver.
          </p>
        </div>

        {/* Los botones quedan afuera de la mezcla: invertidos se leerían como
            un error de render, no como una decisión. */}
        <div className="mt-9 flex flex-wrap gap-3.5">
          <a
            href={linkWhatsApp("Hola Halley, quiero pedir un presupuesto.")}
            target="_blank"
            rel="noreferrer"
            className={hayVideo ? botonSobreVideo : botonSolido}
          >
            <IconoWhatsApp />
            Pedir presupuesto
          </a>
          <a
            href="#servicios"
            className={hayVideo ? botonSobreVideoFantasma : botonFantasma}
          >
            <IconoFlecha />
            Ver servicios
          </a>
        </div>
      </div>

      <a
        href="#concepto"
        aria-label="Bajar"
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 ${
          hayVideo ? "text-white/70 hover:text-white" : "text-gray-45 hover:text-ink"
        }`}
      >
        <IconoBajar className="h-4 w-4" />
      </a>
    </section>
  );
}

/* Sobre el video el tema no decide nada: el fondo es oscuro siempre. */
const botonSobreVideo =
  "inline-flex items-center justify-center gap-2 border border-white bg-white px-[22px] py-[13px] font-rotulo text-[13px] uppercase tracking-[0.04em] text-black transition-colors hover:bg-transparent hover:text-white";
const botonSobreVideoFantasma =
  "inline-flex items-center justify-center gap-2 border border-white/70 px-[22px] py-[13px] font-rotulo text-[13px] uppercase tracking-[0.04em] text-white transition-colors hover:bg-white hover:text-black";

/**
 * La estela del cometa, cuando todavía no hay video de portada.
 *
 * Se dibuja una sola vez al cargar y no vuelve a correr: es el concepto de la
 * marca hecho comportamiento. Un loop diría exactamente lo contrario.
 */
function Estela() {
  return (
    <svg
      className="pointer-events-none absolute -top-20 -right-24 h-[520px] w-[900px] max-w-none opacity-60 sm:opacity-100"
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
    <section id="concepto" className="border-b border-gray-20">
      <div className="mx-auto grid max-w-[1140px] gap-10 px-6 py-20 sm:px-10 sm:py-24 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <h2 className="font-titulo text-[clamp(1.9rem,4.4vw,3.4rem)] leading-[0.96] uppercase">
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
 * El manual presenta los servicios como franjas horizontales apiladas y no
 * como tarjetas: se usa ese mismo gesto. Cada banda lleva su propio material y
 * lleva a su página.
 */
function Servicios() {
  return (
    <section id="servicios" className="border-b border-gray-20">
      <div className="mx-auto max-w-[1140px] px-6 pt-20 sm:px-10 sm:pt-24">
        <p className="font-rotulo text-[12.5px] uppercase tracking-[0.22em] text-gray-70">
          Qué hacemos
        </p>
        <h2 className="mt-4 max-w-[18ch] font-titulo text-[clamp(2rem,5.5vw,4rem)] leading-[0.92] uppercase">
          Cuatro tipos de día
        </h2>
      </div>

      <div className="mt-12 border-t border-gray-20">
        {SERVICIOS.map((s) => (
          <Link
            key={s.slug}
            href={`/servicios/${s.slug}`}
            className="group block border-b border-gray-20 transition-colors duration-300 hover:bg-paper-dimmer focus-visible:bg-paper-dimmer"
          >
            <div className="mx-auto flex max-w-[1140px] flex-col gap-6 px-6 py-8 sm:px-10 sm:py-10 lg:flex-row lg:items-center lg:gap-10">
              <h3 className="font-titulo text-[clamp(2rem,5vw,3.6rem)] leading-[0.88] uppercase lg:w-[24%] lg:shrink-0">
                {s.nombre}
              </h3>

              <Medio
                src={`/servicios/${s.slug}-portada.jpg`}
                alt={s.nombre}
                proporcion="aspect-[16/10]"
                className="lg:w-[26%] lg:shrink-0"
              />

              <div className="lg:flex-1">
                <p className="text-[15.5px] leading-snug">{s.linea}</p>
                <p className="mt-2.5 max-w-[52ch] text-[14px] leading-relaxed text-gray-70">
                  {s.detalle}
                </p>
              </div>

              <span className="inline-flex shrink-0 items-center gap-2 font-rotulo text-[12.5px] uppercase tracking-[0.12em] text-gray-45 transition-colors group-hover:text-ink">
                Ver {s.nombre.toLowerCase()}
                <IconoFlecha />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- cómo */

function Como() {
  return (
    <section id="como" className="border-b border-gray-20">
      <div className="mx-auto max-w-[1140px] px-6 py-20 sm:px-10 sm:py-24">
        <p className="font-rotulo text-[12.5px] uppercase tracking-[0.22em] text-gray-70">
          Cómo trabajamos
        </p>
        <h2 className="mt-4 max-w-[20ch] font-titulo text-[clamp(1.9rem,5vw,3.6rem)] leading-[0.92] uppercase">
          Lo que no negociamos
        </h2>

        {/* Cuatro cosas que sostenemos a la vez, no cuatro pasos: por eso no
            van numeradas. */}
        <div className="mt-11 grid gap-px border border-gray-20 bg-gray-20 sm:grid-cols-2">
          {NO_NEGOCIABLES.map((n) => (
            <div key={n.titulo} className="bg-paper p-7 sm:p-9">
              <h3 className="font-titulo text-[clamp(1.4rem,2.6vw,1.9rem)] leading-tight uppercase">
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
      <div className="mx-auto grid max-w-[1140px] gap-12 px-6 py-20 sm:px-10 sm:py-24 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <h2 className="max-w-[16ch] font-titulo text-[clamp(2.2rem,6vw,4.4rem)] leading-[0.9] uppercase">
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
              <IconoWhatsApp />
              Escribir por WhatsApp
            </a>
            <a
              href={INSTAGRAM}
              target="_blank"
              rel="noreferrer"
              className={botonFantasma}
            >
              <IconoInstagram />
              Ver el Instagram
            </a>
            <a href={`mailto:${MAIL}`} className={botonFantasma}>
              <IconoSobre />
              Escribir un mail
            </a>
          </div>
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
            className="mt-5 inline-flex items-center gap-2 font-rotulo text-[13px] uppercase tracking-[0.08em] underline underline-offset-4 hover:text-gray-70"
          >
            Entrar a mi panel
            <IconoFlecha />
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
