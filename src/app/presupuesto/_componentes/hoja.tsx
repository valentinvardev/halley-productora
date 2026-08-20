import { IconoRegalo } from "~/app/_components/iconos";
import { Logotipo } from "~/app/_components/logotipo";
import {
  EVENTOS,
  HALLEY_BOX,
  cierreDe,
  muestraMonto,
  planDe,
  progresoBox,
  type Evento,
  type Linea,
  type Parametros,
} from "~/app/_datos/presupuesto";
import { fecha, fechaLarga, pesos } from "~/lib/format";

import { AvisoReferencia } from "./simulador";

/**
 * El presupuesto como documento: membrete, detalle, cómo se paga y pie.
 *
 * Existe como componente y no suelto en la página porque se mira en dos lados:
 * la página pública que ve quien lo armó, y el panel, donde Halley lo abre para
 * leerlo sin salir de la lista. Que sea el mismo componente es lo que hace que
 * lo que el panel muestra sea el documento y no una versión parecida — la clase
 * de cosa que se desincroniza el día que se cambia un renglón en un solo lado.
 *
 * Devuelve un fragmento y no un contenedor propio a propósito: sus bloques
 * tienen que ser hijos directos de `.hoja`, que es contra quien están escritas
 * las reglas de impresión que los aprietan para que entren en una carilla.
 *
 * En `pantalla` el membrete y el pie están ocultos —arriba ya hay una barra con
 * el logo y repetirlo sería decir dos veces lo mismo— y aparecen sólo al
 * imprimir. En `documento` están siempre: es el modo en que se lo mira como lo
 * que va a salir en el PDF.
 */

export type DatosHoja = {
  codigo: string;
  evento: Evento;
  nombre: string;
  lineas: Linea[];
  total: number;
  reserva: number;
  plan: string;
  fechaEvento: Date | null;
  creadoEn: Date;
};

export function Hoja({
  p,
  parametros,
  contacto,
}: {
  p: DatosHoja;
  parametros: Parametros;
  contacto: { instagram: string; mail: string; whatsapp: string };
}) {
  const evento = EVENTOS[p.evento];
  const plan = planDe(p.plan);
  // El cierre se recalcula del total guardado y no del catálogo de hoy: es lo
  // que hace que un presupuesto viejo siga diciendo lo que decía.
  const cierre = cierreDe(p.total, p.plan, parametros);
  const box = progresoBox(p.total, parametros);

  // En la web el Instagram es un link; en papel una URL larga es ruido, así que
  // se imprime el usuario, que es lo que alguien tipea.
  const instagram = `@${contacto.instagram.replace(/\/+$/, "").split("/").pop() ?? ""}`;

  return (
    <>
      {/* --------------------------------------------------------- membrete */}
      <div className="solo-imprimir membrete">
        {/* `ansioso` porque este bloque está apagado en pantalla: sin eso la
            imagen queda esperando a acercarse a un cuadro al que nunca va a
            llegar, y el PDF sale con el membrete sin logo. */}
        <Logotipo variante="isologo" className="h-[17mm]" ansioso />

        <div className="membrete-datos">
          <p className="font-rotulo text-[10px] tracking-[0.24em] text-gray-45 uppercase">
            Presupuesto
          </p>
          <p className="mt-1 font-mono text-[13px] tracking-[0.06em]">
            {p.codigo}
          </p>
          <p className="mt-1 text-[10px] text-gray-45">
            Emitido el {fechaLarga(p.creadoEn)}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------- título del documento */}
      <div className="solo-imprimir">
        <p className="font-rotulo text-[11.5px] tracking-[0.22em] text-gray-70 uppercase">
          {evento.nombre}
        </p>
        <p className="mt-2 font-titulo text-[26px] leading-[0.95] uppercase">
          {p.nombre}
        </p>
        <p className="mt-1 text-[11.5px] text-gray-70">
          {p.fechaEvento
            ? `Para el ${fechaLarga(p.fechaEvento)}`
            : "Fecha del evento a confirmar"}
        </p>
      </div>

      {/* -------------------------------------------------------- la tarjeta */}
      <div className="par mt-6 grid gap-px border border-gray-20 bg-gray-20 lg:grid-cols-[1.25fr_1fr]">
        {/* El detalle: qué se contrató. */}
        <div className="caja bg-paper p-6 sm:p-8">
          <h2 className="font-titulo text-[clamp(1.4rem,3vw,1.9rem)] leading-tight uppercase">
            Qué incluye
          </h2>

          <ul className="mt-5 divide-y divide-gray-20 border-y border-gray-20">
            {p.lineas.map((l) => (
              <li
                key={l.id}
                // Las coberturas cuelgan del momento de arriba. Corridas y en
                // gris se leen como lo que son: con qué se cubre eso, no otra
                // cosa contratada aparte. En una lista al mismo nivel, "Video y
                // dron" tres veces parecería un error de carga.
                className={`flex items-baseline justify-between gap-4 py-3 ${
                  l.bajo ? "linea-hija pl-5 text-gray-70" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className={l.bajo ? "text-[13px]" : "text-[14.5px]"}>
                    {l.bajo && <span aria-hidden="true">· </span>}
                    {l.nombre}
                  </span>
                  {l.detalle && (
                    <span className="block text-[12.5px] text-gray-45">
                      {l.detalle}
                    </span>
                  )}
                </span>
                {muestraMonto(l) && (
                  <span
                    className={`tabular-nums whitespace-nowrap ${
                      l.bajo ? "text-[13px]" : "text-[14px]"
                    }`}
                  >
                    {pesos(l.precio)}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-baseline justify-between gap-4">
            <span className="font-rotulo text-[11.5px] tracking-[0.08em] uppercase">
              Total
            </span>
            <span className="text-[22px] font-medium tabular-nums">
              {pesos(p.total)}
            </span>
          </div>

          {p.fechaEvento && (
            <p className="nota no-imprimir mt-6 text-[13px]">
              Fecha del evento: {fecha(p.fechaEvento)} — se puede cambiar.
            </p>
          )}
        </div>

        {/* La plata: cómo se paga. */}
        <div className="caja bg-paper-dim p-6 sm:p-8">
          <h2 className="font-titulo text-[clamp(1.4rem,3vw,1.9rem)] leading-tight uppercase">
            Cómo se paga
          </h2>

          <div className="mt-6">
            <p className="font-rotulo text-[11px] tracking-[0.12em] text-gray-45 uppercase">
              Reserva
            </p>
            <p className="mt-1 text-[clamp(1.7rem,5vw,2.3rem)] leading-none font-medium tabular-nums">
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
            <p className="mt-1 text-[clamp(1.4rem,4vw,1.9rem)] leading-none font-medium tabular-nums">
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
            <span className="text-[19px] font-medium tabular-nums">
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

      {!parametros.preciosConfirmados && (
        <AvisoReferencia className="no-imprimir mt-6" />
      )}

      {/* ------------------------------------------------------ pie de hoja */}
      {/* Lo que en pantalla está repartido —el aviso de que los precios son de
          referencia, la nota de que esto no es una contratación, los datos de
          contacto que viven en la barra— acá se junta en un pie, que es donde
          un documento pone la letra chica. Sin esto la hoja termina en un
          número y no dice ni de quién es ni a quién escribirle. */}
      <div className="solo-imprimir pie-hoja">
        <div>
          <p className="font-rotulo text-[9.5px] tracking-[0.18em] uppercase">
            Halley Audiovisual
          </p>
          <p className="mt-1 text-[9.5px] text-gray-45">
            Córdoba, Argentina · {contacto.mail}
          </p>
          <p className="text-[9.5px] text-gray-45">
            WhatsApp {contacto.whatsapp} · {instagram}
          </p>
        </div>

        <p className="max-w-[62ch] text-right text-[9.5px] leading-relaxed text-gray-45">
          {parametros.preciosConfirmados
            ? "Los valores quedan congelados al abonar la reserva."
            : "Los valores son de referencia y se confirman al contactarte, y quedan congelados al abonar la reserva."}{" "}
          Este presupuesto no es una contratación. Guardá el código {p.codigo}:
          con él lo volvemos a abrir y seguimos desde ahí.
        </p>
      </div>
    </>
  );
}
