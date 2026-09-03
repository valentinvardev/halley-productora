import type { Metadata } from "next";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";

import { FUENTES_MARCA } from "./_components/fuentes";
import {
  IconoBajar,
  IconoCalculadora,
  IconoFlecha,
  IconoInstagram,
  IconoSobre,
  IconoWhatsApp,
} from "./_components/iconos";
import { Aparecer } from "./_components/aparecer";
import { DesplazamientoSuave } from "./_components/desplazamiento";
import { EditorLanding } from "./_components/editor-landing";
import { FondoVideo } from "./_components/fondo-video";
import { LogoAnimado } from "./_components/logo-animado";
import { TarjetaServicio } from "./_components/tarjeta-servicio";
import { Logotipo } from "./_components/logotipo";
import { existeEnPublico } from "./_components/medio";
import { NavPublica } from "./_components/nav-publica";
import { heroAleatorio, muestraDe } from "~/server/contenido";
import { MosaicoPortadas } from "./_components/mosaico-portadas";
import { botonFantasma, botonSolido, botonWhatsApp } from "./_components/ui";
import { eventoDeServicio } from "./_datos/presupuesto";
import { SERVICIOS } from "./_datos/servicios";
import { contacto, linkWhatsApp } from "~/server/ajustes";
import { COOKIE_ADMIN, cookieValida } from "~/server/auth";
import { textosDeBloque } from "~/server/textos-sitio";

export const metadata: Metadata = {
  title: "Halley Audiovisual — Productora en Córdoba",
  description:
    "Dron, fotografía y video para egresados, bodas, quince años y marcas. Los momentos son fugaces: Halley los hace eternos.",
};

// Lee el contenido de la vitrina en cada visita, así lo que el admin sube
// aparece sin esperar un redeploy.
export const dynamic = "force-dynamic";

const SECCIONES = [
  { href: "#servicios", texto: "Servicios" },
  { href: "#como", texto: "Cómo trabajamos" },
  { href: "#contacto", texto: "Contacto" },
];

/** Celdas de la grilla de cada tipo de evento: alcanza para la pantalla ancha. */
const CELDAS_GRILLA = 8;

const VIDEO_PORTADA = "/portada/portada.mp4";
const POSTER_PORTADA = "/portada/portada.jpg";

/* Los textos de estas dos secciones ya no viven acá: se editan desde el panel y
   salen de `textos-sitio.ts`, que guarda lo cambiado y cae al texto de fábrica
   cuando no hay nada guardado. */

/**
 * Quién puede editar los textos tocándolos en la página.
 *
 * Se pide con `?editar=1` y además hay que ser administrador. Las dos
 * condiciones hacen falta: sin la cookie cualquiera entraría al modo escribiendo
 * la query, y sin la query un administrador no podría ver nunca su propio sitio
 * como lo ve un cliente, con la página llena de punteados.
 *
 * La consulta de la cookie no le cuesta nada al visitante común: la portada ya
 * era dinámica porque lee la vitrina en cada visita.
 */
async function enModoEdicion(pedido: boolean) {
  if (!pedido) return false;
  const galleta = await cookies();
  return cookieValida(galleta.get(COOKIE_ADMIN)?.value);
}

export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>;
}) {
  // Los datos de contacto salen del panel, no del codigo.
  const datos = await contacto();
  // La portada que subió el admin manda; si no hay, el archivo del repo.
  const hero = await heroAleatorio();

  const { editar } = await searchParams;
  const editando = await enModoEdicion(editar === "1");

  return (
    <div className={`landing ${FUENTES_MARCA}`}>
      {/* No pinta nada: engancha el desenfoque de los anclajes. */}
      <DesplazamientoSuave />
      {editando && <EditorLanding />}
      <NavPublica secciones={SECCIONES} />

      <Hero whatsapp={datos.whatsapp} hero={hero} editando={editando} />
      <Concepto editando={editando} />
      <Servicios editando={editando} />
      <Como editando={editando} />
      <Contacto datos={datos} editando={editando} />
      <Pie />
    </div>
  );
}

/**
 * Marca un texto como editable, para que el editor sepa cuál es.
 *
 * Devuelve un atributo y nada más. Fuera del modo edición devuelve un objeto
 * vacío, así que la página que ve un cliente sale exactamente igual que antes:
 * ni un nodo de más, ni una clase de más. El punteado que se ve al editar lo
 * pone el CSS enganchado a este atributo, no una clase que haya que ir sumando
 * a cada elemento.
 */
function editable(campo: string, editando: boolean) {
  return editando ? { "data-texto": campo } : {};
}

/* --------------------------------------------------------------------- hero */

async function Hero({
  whatsapp,
  hero,
  editando,
}: {
  whatsapp: string;
  hero: { url: string; tipo: "imagen" | "video" } | null;
  editando: boolean;
}) {
  const t = await textosDeBloque("hero");
  const hayVideo = existeEnPublico(VIDEO_PORTADA);
  const hayPoster = existeEnPublico(POSTER_PORTADA);
  // Con cualquiera de los tres el fondo pasa a ser oscuro, y eso es lo que
  // decide cómo se pintan los botones.
  const hayFondo = !!hero || hayVideo || hayPoster;

  return (
    <section className="hero aisla relative flex flex-col justify-center overflow-hidden border-b border-gray-20">
      {hero ? (
        // Lo que el admin subió desde el panel manda sobre el respaldo.
        hero.tipo === "video" ? (
          <video
            src={hero.url}
            muted
            loop
            autoPlay
            playsInline
            disablePictureInPicture
            disableRemotePlayback
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero.url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )
      ) : hayVideo ? (
        <video
          src={VIDEO_PORTADA}
          poster={hayPoster ? POSTER_PORTADA : undefined}
          muted
          loop
          autoPlay
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : hayPoster ? (
        // Mientras no esté el video, el primer cuadro alcanza para ver cómo va
        // a quedar: el titular ya se lee contra una imagen, no contra el papel.
        <Image
          src={POSTER_PORTADA}
          alt=""
          aria-hidden="true"
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
      ) : (
        <Estela />
      )}

      {/* Empareja el fondo antes de la mezcla: con la imagen más pareja, la
          inversa del titular sale siempre del lado claro. */}
      {hayFondo && (
        <div
          className="absolute inset-0 bg-[rgb(0_0_0/0.42)]"
          aria-hidden="true"
        />
      )}

      {/* En desktop el bloque se corre a la izquierda: la caja crece hasta
          1560px y el contenido se ancla al principio, así el titular arranca
          cerca del borde en vez de quedar centrado en el medio de la pantalla.
          Hasta `lg` sigue centrado, que en pantallas angostas es lo correcto. */}
      <div className="relative mx-auto w-full max-w-[1140px] px-6 sm:px-10 lg:mx-0 lg:max-w-[1560px] lg:pl-16 xl:pl-24">
        <div className="negativo lg:max-w-[52ch]">
          <p
            {...editable("hero.rotulo", editando)}
            className="font-rotulo text-[12px] uppercase tracking-[0.22em] sm:text-[12.5px]"
          >
            {t.rotulo}
          </p>

          {/* El titular es el eslogan del manual, tal cual.

              Los tres renglones son tres campos y no un texto con saltos. Un
              texto con saltos deja el corte de línea en manos de dónde termine
              la palabra, y acá el corte es parte del eslogan. Además el tercero
              se pinta distinto, que en un solo campo no se podría. */}
          <h1 className="titular-hero mt-6">
            <span {...editable("hero.titular1", editando)}>{t.titular1}</span>
            <br />
            <span {...editable("hero.titular2", editando)}>{t.titular2}</span>
            <br />
            <span
              {...editable("hero.remate", editando)}
              className="titular-remate"
            >
              {t.remate}
            </span>
          </h1>

          <p
            {...editable("hero.bajada", editando)}
            className="mt-7 max-w-[46ch] text-[14.5px] leading-relaxed"
          >
            {t.bajada}
          </p>
        </div>

        {/* Los botones quedan afuera de la mezcla: invertidos se leerían como
            un error de render, no como una decisión. */}
        <div className="mt-9 flex flex-wrap gap-3.5">
          <a
            href={linkWhatsApp(whatsapp, t.mensajeWhatsapp)}
            target="_blank"
            rel="noreferrer"
            className={botonWhatsApp}
          >
            <IconoWhatsApp />
            {/* La marca va en el texto y no en el botón: adentro del botón el
                clic navegaría antes de que el editor lo agarre. */}
            <span {...editable("hero.boton", editando)}>{t.boton}</span>
          </a>
          <a
            href="#servicios"
            className={hayFondo ? botonSobreVideoFantasma : botonFantasma}
          >
            <IconoFlecha />
            <span {...editable("hero.botonSecundario", editando)}>
              {t.botonSecundario}
            </span>
          </a>
        </div>
      </div>

      <a
        href="#concepto"
        aria-label="Bajar"
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 ${
          hayFondo
            ? "text-white/70 hover:text-white"
            : "text-gray-45 hover:text-ink"
        }`}
      >
        <IconoBajar className="h-4 w-4" />
      </a>
    </section>
  );
}

/* Sobre el video el tema no decide nada: el fondo es oscuro siempre. */
const botonSobreVideoFantasma =
  "inline-flex items-center justify-center gap-2 border border-white/70 px-[22px] py-[13px] font-rotulo text-[13px] uppercase tracking-[0.04em] text-white transition-colors hover:bg-white hover:text-black";

/* Los dos botones al pie de cada tarjeta de servicio.

   Sobre foto el tema no decide nada: el fondo es oscuro siempre y el par es
   blanco contra blanco. Comparten caja —mismo alto, mismo borde, mismo
   cuerpo— y se diferencian sólo por el relleno: uno es el contorno y el otro
   está lleno. Al hover intercambian, así que la tarjeta nunca tiene dos
   botones pintados igual. */
const botonSobreFotoBase =
  "inline-flex items-center gap-2 border border-white px-[18px] py-[11px] font-rotulo text-[12px] uppercase tracking-[0.04em] transition-colors";
const botonSobreFoto = `${botonSobreFotoBase} text-white hover:bg-white hover:text-black`;
const botonSobreFotoSolido = `${botonSobreFotoBase} bg-white text-black hover:bg-transparent hover:text-white`;

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

async function Concepto({ editando }: { editando: boolean }) {
  const t = await textosDeBloque("concepto");

  return (
    <section
      id="concepto"
      // La sección mide lo que mide su texto. Tuvo alto de más un tiempo —una
      // pantalla y media— para darle recorrido al dibujo del cometa; ahora ese
      // recorrido se mide contra la ventana y el alto sobraba: se veía como un
      // hueco enorme alrededor del texto.
      // El papel va declarado y no heredado del `body`: es contra este fondo
      // que el cometa se mezcla para perder su recuadro negro, y mezclar contra
      // el lienzo de la página depende de detalles del navegador.
      className="relative border-b border-gray-20 bg-paper"
    >
      {/* El contenedor no lleva `z`: con uno propio se volvería un grupo de
          apilado aparte y la mezcla que le saca el fondo negro al cometa se
          quedaría encerrada adentro. Sin `z` no hace falta: el cometa y el texto
          no se pisan en ningún ancho. */}
      <div className="relative mx-auto grid max-w-[1140px] gap-10 px-6 py-28 sm:px-10 sm:py-36 lg:min-h-[620px] lg:grid-cols-[1.05fr_1fr] lg:gap-x-16 lg:py-40 lg:pl-[290px]">
        {/* El cometa cambia de lugar según haya o no dónde ponerlo.

            En pantalla grande sobra margen afuera de la columna de texto y ahí
            va, fuera del flujo. El contenedor le reserva ese lugar corriendo el
            texto 290 a la derecha, así que la pieza puede crecer y moverse sin
            negociar con nada.

            De izquierda arranca media franja adentro del margen: `285px - 25vw`
            es la mitad de lo que sobra afuera de la columna, y el `min` con cero
            evita que se salga por el borde en pantallas donde no sobra nada.

            De alto no va centrada en el contenedor sino un poco más arriba. El
            contenedor lo estira la columna de texto, que es más alta que el
            titular, así que su centro cae por debajo del centro del título. Los
            2,75rem son ese desfasaje. Es un número aproximado: si el titular
            cambia de largo y pasa a ocupar otra cantidad de líneas, hay que
            volver a mirarlo.

            En pantallas angostas ese margen no existe. Antes pasaba a ser marca
            de agua detrás del texto, que es ponerlo donde no hay lugar. Ahora
            entra en el flujo y se queda con una fila propia arriba del título:
            se hace el lugar en vez de robarlo, y de paso la fila la reserva él
            mismo, sin un alto escrito en otro lado que haya que mantener igual
            al suyo.

            El tope de 245 es por el alto, no por el ancho: la pieza es cuadrada,
            así que ancho y alto son lo mismo, y fuera del flujo de pasarse se
            metería en las secciones vecinas. El piso de 620 en el contenedor es
            la red: la pieza se corre 240 a lo largo del recorrido, así que
            necesita 245 + 240 de alto para no desbordar.

            Los anchos van con la cuenta ya resuelta —`22,7vw - 146px` y no una
            multiplicación anidada— porque Tailwind no parsea el calc anidado y
            descarta la clase sin avisar. */}
        <LogoAnimado className="w-[45%] max-w-[218px] opacity-80 lg:absolute lg:top-[calc(50%_-_2.75rem)] lg:left-[min(0px,calc(285px_-_25vw))] lg:w-[calc(22.7vw_-_146px)] lg:max-w-[245px] lg:-translate-y-1/2 lg:opacity-70" />

        <Aparecer>
          <h2 className="font-titulo text-[clamp(1.9rem,4.4vw,3.4rem)] leading-[0.96] uppercase">
            <span {...editable("concepto.titulo1", editando)}>{t.titulo1}</span>
            <br />
            <span
              {...editable("concepto.titulo2", editando)}
              className="text-gray-70"
            >
              {t.titulo2}
            </span>
          </h2>
        </Aparecer>

        <Aparecer
          demora={0.12}
          className="max-w-[54ch] space-y-5 text-[15px] leading-relaxed text-gray-70"
        >
          <p {...editable("concepto.parrafo1", editando)}>{t.parrafo1}</p>
          <p {...editable("concepto.parrafo2", editando)}>{t.parrafo2}</p>
          <p {...editable("concepto.parrafo3", editando)} className="text-ink">
            {t.parrafo3}
          </p>
        </Aparecer>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- servicios */

/**
 * Los paneles.
 *
 * Antes eran franjas horizontales de unos 200px: alcanzaban para listar los
 * servicios, no para mostrar trabajo. Ahora cada categoría se lleva una
 * pantalla entera, queda clavada mientras se recorre su tramo y la siguiente
 * entra deslizándose por encima.
 */
async function Servicios({ editando }: { editando: boolean }) {
  const t = await textosDeBloque("servicios");
  // El fondo de cada panel es una grilla de trabajos al azar de esa categoría;
  // si no hay ninguno, el relleno. Se resuelve en el servidor, por pedido, así
  // que cada visita ve otras fotos.
  const fondos = await Promise.all(
    SERVICIOS.map((s) => muestraDe(s.slug, CELDAS_GRILLA)),
  );

  return (
    <section id="servicios" className="border-b border-gray-20">
      <div className="mx-auto max-w-[1140px] px-6 pt-20 pb-14 sm:px-10 sm:pt-24">
        <p
          {...editable("servicios.rotulo", editando)}
          className="font-rotulo text-[12.5px] uppercase tracking-[0.22em] text-gray-70"
        >
          {t.rotulo}
        </p>
        <h2
          {...editable("servicios.titulo", editando)}
          className="mt-4 max-w-[18ch] font-titulo text-[clamp(2rem,5.5vw,4rem)] leading-[0.92] uppercase"
        >
          {t.titulo}
        </h2>
      </div>

      {/* Dos por dos en escritorio, una columna en el teléfono. La separación
          es una línea de un píxel, como la grilla del mosaico: el fondo gris
          asoma por el `gap` y no hace falta un borde por tarjeta. */}
      <div className="grid gap-px border-y border-gray-20 bg-gray-20 lg:grid-cols-2">
        {SERVICIOS.map((s, i) => {
          const portadas = fondos[i] ?? [];
          // Sólo bodas y quince tienen catálogo de precios; las otras dos
          // categorías se cotizan hablando, y la función lo sabe por las dos.
          const evento = eventoDeServicio(s.slug);
          return (
            <TarjetaServicio
              key={s.slug}
              className="group aisla relative flex h-[50svh] items-end overflow-hidden lg:h-[52svh]"
            >
              {/* Las tres categorías de evento tienen el movimiento ya rendido
                  en video: la cámara avanzando de verdad, no una foto partida en
                  planos. Marcas se queda con la grilla de trabajos, que es lo
                  que tiene para mostrar. */}
              {s.slug === "bodas" ||
              s.slug === "egresados" ||
              s.slug === "quince" ? (
                <FondoVideo nombre={s.slug} />
              ) : portadas.length > 0 ? (
                <MosaicoPortadas piezas={portadas} />
              ) : (
                <Image
                  src={`/servicios/${s.slug}-portada.jpg`}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  priority={i === 0}
                  className="fondo-servicio object-cover"
                />
              )}

              {/* Sombra al pie: sostiene el texto por más clara que sea la foto
                  de fondo. */}
              <div
                className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[rgb(0_0_0/0.9)] via-[rgb(0_0_0/0.45)] to-transparent"
                aria-hidden="true"
              />

              {/* La tarjeta entera lleva a la categoría, no sólo el botón.

                  Es un link estirado sobre toda la tarjeta, debajo del texto y
                  de los botones, que siguen siendo suyos. Lo que aporta es que
                  el cursor avise en cualquier parte de la foto que se puede
                  entrar, y que tocar la foto entre.

                  Sin nombre accesible propio ni parada de tabulador: el botón
                  "Ver" de abajo ya es el link con nombre, y este sería el mismo
                  destino leído dos veces. */}
              <Link
                href={`/servicios/${s.slug}`}
                tabIndex={-1}
                aria-hidden="true"
                className="absolute inset-0"
              />

              <div className="relative w-full px-6 pb-8 sm:px-8 sm:pb-10">
                <p className="font-rotulo text-[11.5px] tracking-[0.22em] text-white/70 uppercase">
                  {String(i + 1).padStart(2, "0")} de {SERVICIOS.length}
                </p>

                {/* Blanco liso, sin el filtro negativo del titular del hero.
                    Allá tiene sentido: el video cambia todo el tiempo y no hay
                    color de texto que sirva siempre. Acá la foto está quieta y
                    hay una sombra al pie que ya garantiza el contraste, así que
                    lo único que aportaba `difference` era invertir el título en
                    los tramos claros y hacerlo leer como un error de render. */}
                <h3 className="mt-2 font-titulo text-[clamp(2.1rem,5.2vw,3.4rem)] leading-[0.88] text-white uppercase">
                  {s.nombre}
                </h3>

                <p className="mt-3 max-w-[42ch] text-[14.5px] leading-snug text-white">
                  {s.linea}
                </p>

                {/* Dos puertas donde las hay: mirar trabajo y armar el precio.
                    Van al mismo peso y no una apagada detrás de la otra. Con
                    tres intensidades de blanco sobre la misma foto —el título,
                    un botón fuerte y uno tenue— la tarjeta se leía como si el
                    segundo botón estuviera deshabilitado. Acá son dos caminos
                    distintos, no uno principal y su nota al pie. */}
                <div className="mt-5 flex flex-wrap gap-2.5">
                  {/* Se prende con el hover de la tarjeta entera y no sólo
                      con el suyo: la tarjeta es el link, y el botón es su
                      etiqueta. Si al pasar por la foto el botón no reacciona,
                      la foto no parece clickeable aunque lo sea. */}
                  <Link
                    href={`/servicios/${s.slug}`}
                    className={`${botonSobreFoto} group-hover:bg-white group-hover:text-black`}
                  >
                    Ver {s.nombre.toLowerCase()}
                    <IconoFlecha />
                  </Link>

                  {evento && (
                    <Link
                      href={`/presupuesto/${evento}`}
                      className={botonSobreFotoSolido}
                    >
                      <IconoCalculadora className="h-3.5 w-3.5" />
                      Simular presupuesto
                    </Link>
                  )}
                </div>
              </div>
            </TarjetaServicio>
          );
        })}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- cómo */

async function Como({ editando }: { editando: boolean }) {
  const t = await textosDeBloque("noNegociamos");

  // Los cuatro pares se arman acá y no en el módulo de textos: allá son campos
  // sueltos porque el editor del panel los pinta uno por uno, y acá son una
  // lista porque la grilla los recorre. Es la misma información con la forma que
  // necesita cada lado.
  const puntos = [
    { titulo: t.titulo1, texto: t.texto1, n: 1 },
    { titulo: t.titulo2, texto: t.texto2, n: 2 },
    { titulo: t.titulo3, texto: t.texto3, n: 3 },
    { titulo: t.titulo4, texto: t.texto4, n: 4 },
  ];

  return (
    <section id="como" className="border-b border-gray-20">
      <div className="mx-auto max-w-[1140px] px-6 py-20 sm:px-10 sm:py-24">
        <p
          {...editable("noNegociamos.rotulo", editando)}
          className="font-rotulo text-[12.5px] uppercase tracking-[0.22em] text-gray-70"
        >
          {t.rotulo}
        </p>
        <h2
          {...editable("noNegociamos.titulo", editando)}
          className="mt-4 max-w-[20ch] font-titulo text-[clamp(1.9rem,5vw,3.6rem)] leading-[0.92] uppercase"
        >
          {t.titulo}
        </h2>

        {/* Cuatro cosas que sostenemos a la vez, no cuatro pasos: por eso no
            van numeradas. */}
        <div className="mt-11 grid gap-px border border-gray-20 bg-gray-20 sm:grid-cols-2">
          {puntos.map((n, i) => (
            <div key={i} className="bg-paper p-7 sm:p-9">
              <h3
                {...editable(`noNegociamos.titulo${n.n}`, editando)}
                className="font-titulo text-[clamp(1.4rem,2.6vw,1.9rem)] leading-tight uppercase"
              >
                {n.titulo}
              </h3>
              <p
                {...editable(`noNegociamos.texto${n.n}`, editando)}
                className="mt-3 max-w-[46ch] text-[14.5px] leading-relaxed text-gray-70"
              >
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

async function Contacto({
  datos,
  editando,
}: {
  datos: { whatsapp: string; instagram: string; mail: string };
  editando: boolean;
}) {
  const t = await textosDeBloque("contacto");

  return (
    <section id="contacto" className="border-b border-gray-20">
      <div className="mx-auto grid max-w-[1140px] gap-12 px-6 py-20 sm:px-10 sm:py-24 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <h2
            {...editable("contacto.titulo", editando)}
            className="max-w-[16ch] font-titulo text-[clamp(2.2rem,6vw,4.4rem)] leading-[0.9] uppercase"
          >
            {t.titulo}
          </h2>
          <p
            {...editable("contacto.bajada", editando)}
            className="mt-6 max-w-[48ch] text-[15.5px] leading-relaxed text-gray-70"
          >
            {t.bajada}
          </p>

          <div className="mt-9 flex flex-wrap gap-3.5">
            <a
              href={linkWhatsApp(
                datos.whatsapp,
                "Hola Halley, quiero consultar por un evento.",
              )}
              target="_blank"
              rel="noreferrer"
              className={botonWhatsApp}
            >
              <IconoWhatsApp />
              Escribir por WhatsApp
            </a>
            <a
              href={datos.instagram}
              target="_blank"
              rel="noreferrer"
              className={botonFantasma}
            >
              <IconoInstagram />
              Ver el Instagram
            </a>
            <a href={`mailto:${datos.mail}`} className={botonFantasma}>
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
        <Logotipo variante="isologo" className="h-28" />

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
