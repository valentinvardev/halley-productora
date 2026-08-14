import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { Copiar } from "~/app/_components/copiar";
import {
  IconoFlecha,
  IconoVolver,
  IconoWhatsApp,
} from "~/app/_components/iconos";
import { botonFantasma, botonWhatsApp } from "~/app/_components/ui";
import { EVENTOS, seleccionDe } from "~/app/_datos/presupuesto";
import { pesos } from "~/lib/format";
import { contacto, linkWhatsApp } from "~/server/ajustes";
import { datosDelSimulador } from "~/server/catalogos";
import { api } from "~/trpc/server";

import { Hoja } from "../../_componentes/hoja";
import { Simulador } from "../../_componentes/simulador";
import { BotonImprimir } from "../../_componentes/boton-imprimir";

/**
 * El presupuesto emitido.
 *
 * Es la pantalla de confirmación, pero además es una página con URL propia, y
 * eso es lo importante: el presupuesto no vive en la pestaña donde se armó. Se
 * puede cerrar el navegador, mandarse el link por WhatsApp, abrirlo desde otro
 * teléfono y seguir estando.
 *
 * Con `?editar` la misma ruta vuelve a abrir el wizard con todo puesto. Guardar
 * pisa el presupuesto en vez de emitir otro: mientras no se abonó la reserva
 * esto es un borrador, y tres códigos de la misma persona sólo complican la
 * conversación.
 */

export const metadata: Metadata = {
  title: "Tu presupuesto — Halley Audiovisual",
  // Un presupuesto es de quien lo armó: que no aparezca en una búsqueda.
  robots: { index: false, follow: false },
};

export default async function PaginaCodigo({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const { codigo } = await params;
  const { editar } = await searchParams;

  const p = await api.presupuesto
    .porCodigo({ codigo: decodeURIComponent(codigo) })
    .catch((e: unknown) => {
      if (e instanceof TRPCError && e.code === "NOT_FOUND") return null;
      throw e;
    });

  if (!p) notFound();

  if (editar !== undefined) {
    const { catalogos, parametros } = await datosDelSimulador();
    return (
      <Simulador
        catalogos={catalogos}
        parametros={parametros}
        retomar={{
          codigo: p.codigo,
          evento: p.evento,
          seleccion: seleccionDe(p.lineas),
          plan: p.plan,
          nombre: p.nombre,
          // El wizard trabaja con "AAAA-MM-DD"; la fecha se guardó al mediodía
          // UTC justamente para que este recorte no se corra de día.
          fechaEvento: p.fechaEvento
            ? p.fechaEvento.toISOString().slice(0, 10)
            : "",
        }}
      />
    );
  }

  const [datos, { parametros }] = await Promise.all([
    contacto(),
    datosDelSimulador(),
  ]);
  const evento = EVENTOS[p.evento];

  const mensaje = [
    `Hola Halley, armé un presupuesto para ${evento.posesivo}.`,
    `Código: ${p.codigo}`,
    `Total: ${pesos(p.total)}`,
  ].join("\n");

  return (
    <div className="hoja mx-auto max-w-[1140px] px-6 py-14 sm:px-10 sm:py-20">
      <div className="no-imprimir">
        <Link
          href="/#servicios"
          className="inline-flex items-center gap-2 font-rotulo text-[12px] tracking-[0.14em] text-gray-45 uppercase hover:text-ink"
        >
          <IconoVolver className="h-3 w-3" />
          Todos los servicios
        </Link>
      </div>

      <header className="no-imprimir mt-10">
        <p className="font-rotulo text-[11.5px] tracking-[0.22em] text-gray-70 uppercase">
          {evento.nombre}
        </p>

        {/* En pantalla esto es una confirmación —acabás de apretar un botón y
            hay que decirte que salió bien—. En papel no hay nada que confirmar,
            así que el documento abre con su propio título, que lo pone `Hoja`. */}
        <h1 className="mt-3 max-w-[20ch] font-titulo text-[clamp(2rem,6vw,3.6rem)] leading-[0.92] uppercase">
          Presupuesto generado con éxito
        </h1>
        <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-gray-70">
          Ya podés abonar la reserva para bloquear la fecha y congelar el
          precio. Guardá el código: con él volvés a abrir este presupuesto y lo
          podés modificar cuando quieras.
        </p>
      </header>

      {/* ------------------------------------------------------- el código */}
      <div className="caja no-imprimir mt-9 border border-ink p-6 sm:p-7">
        <p className="font-rotulo text-[11px] tracking-[0.14em] text-gray-45 uppercase">
          Código de seguimiento
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
          <p className="font-mono text-[clamp(1.1rem,4.4vw,1.7rem)] tracking-[0.06em] break-all">
            {p.codigo}
          </p>
          <span className="no-imprimir">
            <Copiar valor={p.codigo} etiqueta="Copiar código" />
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------ el documento */}
      <Hoja p={p} parametros={parametros} contacto={datos} />

      {/* ------------------------------------------------------- acciones */}
      <div className="no-imprimir mt-9 flex flex-wrap gap-3.5">
        <a
          href={linkWhatsApp(datos.whatsapp, mensaje)}
          target="_blank"
          rel="noreferrer"
          className={botonWhatsApp}
        >
          <IconoWhatsApp />
          Contactar por WhatsApp
        </a>

        <BotonImprimir />

        <Link
          href={`/presupuesto/codigo/${encodeURIComponent(p.codigo)}?editar`}
          className={botonFantasma}
        >
          <IconoFlecha />
          Reeditar
        </Link>
      </div>

      <p className="nota no-imprimir mt-8 max-w-[62ch] text-[13px]">
        Este presupuesto no es una contratación: es lo que armaste, guardado.
        Cuando nos escribas lo abrimos con el código y seguimos desde ahí.
      </p>
    </div>
  );
}
