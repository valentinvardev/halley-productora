import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { Copiar } from "~/app/_components/copiar";
import {
  IconoFlecha,
  IconoRegalo,
  IconoVolver,
  IconoWhatsApp,
} from "~/app/_components/iconos";
import { botonFantasma, botonWhatsApp } from "~/app/_components/ui";
import {
  EVENTOS,
  HALLEY_BOX,
  PRECIOS_CONFIRMADOS,
  cierreDe,
  planDe,
  progresoBox,
  seleccionDe,
} from "~/app/_datos/presupuesto";
import { fecha, pesos } from "~/lib/format";
import { contacto, linkWhatsApp } from "~/server/ajustes";
import { api } from "~/trpc/server";

import { AvisoReferencia, Simulador } from "../../_componentes/simulador";
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
    return (
      <Simulador
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

  const datos = await contacto();
  const evento = EVENTOS[p.evento];
  const plan = planDe(p.plan);
  // El cierre se recalcula del total guardado y no del catálogo de hoy: es lo
  // que hace que un presupuesto viejo siga diciendo lo que decía.
  const cierre = cierreDe(p.total, p.plan);
  const box = progresoBox(p.total);

  const mensaje = [
    `Hola Halley, armé un presupuesto para ${evento.posesivo}.`,
    `Código: ${p.codigo}`,
    `Total: ${pesos(p.total)}`,
  ].join("\n");

  return (
    <div className="mx-auto max-w-[1140px] px-6 py-14 sm:px-10 sm:py-20">
      <div className="no-imprimir">
        <Link
          href="/#servicios"
          className="inline-flex items-center gap-2 font-rotulo text-[12px] tracking-[0.14em] text-gray-45 uppercase hover:text-ink"
        >
          <IconoVolver className="h-3 w-3" />
          Todos los servicios
        </Link>
      </div>

      <header className="mt-10">
        <p className="font-rotulo text-[11.5px] tracking-[0.22em] text-gray-70 uppercase">
          {evento.nombre}
        </p>
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
      <div className="mt-9 border border-ink p-6 sm:p-7">
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

      {/* ------------------------------------------------------ la tarjeta */}
      <div className="mt-6 grid gap-px border border-gray-20 bg-gray-20 lg:grid-cols-[1.25fr_1fr]">
        {/* El detalle: qué se contrató. */}
        <div className="bg-paper p-6 sm:p-8">
          <h2 className="font-titulo text-[clamp(1.4rem,3vw,1.9rem)] leading-tight uppercase">
            Qué incluye
          </h2>

          <ul className="mt-5 divide-y divide-gray-20 border-y border-gray-20">
            {p.lineas.map((l) => (
              <li
                key={l.id}
                className="flex items-baseline justify-between gap-4 py-3"
              >
                <span className="min-w-0">
                  <span className="text-[14.5px]">{l.nombre}</span>
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

          <div className="mt-4 flex items-baseline justify-between gap-4">
            <span className="font-rotulo text-[11.5px] tracking-[0.08em] uppercase">
              Total
            </span>
            <span className="font-display text-[22px] tabular-nums">
              {pesos(p.total)}
            </span>
          </div>

          {p.fechaEvento && (
            <p className="nota mt-6 text-[13px]">
              Fecha del evento: {fecha(p.fechaEvento)} — se puede cambiar.
            </p>
          )}
        </div>

        {/* La plata: cómo se paga. */}
        <div className="bg-paper-dim p-6 sm:p-8">
          <h2 className="font-titulo text-[clamp(1.4rem,3vw,1.9rem)] leading-tight uppercase">
            Cómo se paga
          </h2>

          <div className="mt-6">
            <p className="font-rotulo text-[11px] tracking-[0.12em] text-gray-45 uppercase">
              Reserva
            </p>
            <p className="mt-1 font-display text-[clamp(1.7rem,5vw,2.3rem)] leading-none tabular-nums">
              {pesos(p.reserva)}
            </p>
            <p className="mt-2 max-w-[36ch] text-[13px] leading-relaxed text-gray-70">
              Bloquea la fecha y congela el precio. Se descuenta del total.
            </p>
          </div>

          <div className="mt-7 border-t border-gray-20 pt-5">
            <p className="font-rotulo text-[11px] tracking-[0.12em] text-gray-45 uppercase">
              Saldo restante
            </p>
            <p className="mt-1 font-display text-[clamp(1.4rem,4vw,1.9rem)] leading-none tabular-nums">
              {cierre.cuotas === 1
                ? pesos(cierre.saldoFinanciado)
                : `${cierre.cuotas} × ${pesos(cierre.porCuota)}`}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-70">
              {plan?.nombre ?? "Pago"} — {plan?.texto ?? ""}
            </p>
          </div>

          <div className="mt-7 flex items-baseline justify-between gap-4 border-t border-ink pt-4">
            <span className="font-rotulo text-[11.5px] tracking-[0.08em] uppercase">
              Total a pagar
            </span>
            <span className="font-display text-[19px] tabular-nums">
              {pesos(cierre.aPagar)}
            </span>
          </div>

          {box.abierta && (
            <p className="mt-6 flex items-start gap-2 border border-ink p-4 text-[13px] leading-relaxed">
              <IconoRegalo className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong className="font-normal">{HALLEY_BOX.nombre}</strong>{" "}
                incluida. {HALLEY_BOX.desbloqueada}
              </span>
            </p>
          )}
        </div>
      </div>

      {!PRECIOS_CONFIRMADOS && <AvisoReferencia className="mt-6" />}

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
