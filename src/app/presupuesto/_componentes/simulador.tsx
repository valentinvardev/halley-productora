"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CampoFecha } from "~/app/_components/campo-fecha";
import {
  IconoAlerta,
  IconoBajar,
  IconoFlecha,
  IconoVolver,
} from "~/app/_components/iconos";
import { Boton, Campo } from "~/app/_components/ui";
import {
  CATALOGO,
  EVENTOS,
  EVENTOS_ORDEN,
  PLANES,
  PRECIOS_CONFIRMADOS,
  SELECCION_VACIA,
  cierreDe,
  depurar,
  lineasDe,
  totalDe,
  type Evento,
  type Item,
  type Seleccion,
} from "~/app/_datos/presupuesto";
import { pesos } from "~/lib/format";
import { api } from "~/trpc/react";

import {
  AvisoFlotante,
  BarraBox,
  Cabecera,
  Detalle,
  Opcion,
  Progreso,
} from "./piezas";

/**
 * El simulador de presupuesto.
 *
 * Un wizard de siete pasos que arma la cobertura, la cotiza en vivo y termina
 * emitiendo un presupuesto con código de seguimiento.
 *
 * Todo el estado vive acá y en memoria: la persona puede ir y venir entre pasos
 * sin que nada se guarde ni se pierda. Recién al confirmar sale un pedido al
 * servidor, y lo que viaja son los ids de lo elegido, no los precios — el total
 * se recalcula del lado del servidor antes de escribir nada. El número que se ve
 * en el pie y el que queda guardado salen del mismo catálogo, así que coinciden
 * por construcción y no porque se los haya sincronizado.
 *
 * El paso 0 —elegir boda o quince— existe sólo cuando se entra por /presupuesto.
 * Desde las tarjetas de la landing se entra con el evento ya puesto, que es de
 * dónde va a venir casi todo el mundo: preguntar de qué es tu evento a alguien
 * que acaba de tocar "Bodas" es hacerlo contestar dos veces lo mismo.
 */

/** Los pasos que llenan el presupuesto — los que tienen punto de progreso. */
const ETIQUETAS = [
  "Momentos",
  "Coberturas",
  "Complementos",
  "Contacto",
  "Fecha",
  "Pago",
];

const PASO_CONTACTO = 4;
const PASO_FECHA = 5;
const PASO_PAGO = 6;

type Datos = {
  nombre: string;
  celular: string;
  email: string;
  quiereCopia: boolean;
};

export type Retomar = {
  codigo: string;
  evento: Evento;
  seleccion: Seleccion;
  plan: string;
  nombre: string;
  fechaEvento: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function Simulador({
  inicial = null,
  retomar = null,
}: {
  /** El evento con el que se entra, cuando se viene de una categoría. */
  inicial?: Evento | null;
  /** Un presupuesto ya emitido que se vuelve a abrir para modificarlo. */
  retomar?: Retomar | null;
}) {
  const router = useRouter();

  const [evento, setEvento] = useState<Evento | null>(
    retomar?.evento ?? inicial,
  );
  const [paso, setPaso] = useState(evento ? 1 : 0);
  /** Hasta dónde llegó: habilita los puntos del progreso ya recorridos. */
  const [maximo, setMaximo] = useState(paso);

  const [sel, setSel] = useState<Seleccion>(
    retomar?.seleccion ?? SELECCION_VACIA,
  );
  const [datos, setDatos] = useState<Datos>({
    nombre: retomar?.nombre ?? "",
    celular: "",
    email: "",
    quiereCopia: true,
  });
  const [fechaEvento, setFechaEvento] = useState(retomar?.fechaEvento ?? "");
  const [plan, setPlan] = useState(retomar?.plan ?? "3");

  const [detalleAbierto, setDetalleAbierto] = useState(false);
  /** Se muestra recién al intentar avanzar: nadie quiere un error antes de escribir. */
  const [reclamo, setReclamo] = useState<string | null>(null);

  const arriba = useRef<HTMLDivElement>(null);

  const partes = evento ? CATALOGO[evento] : [];
  const lineas = useMemo(
    () => (evento ? lineasDe(evento, sel) : []),
    [evento, sel],
  );
  const total = totalDe(lineas);
  const cierre = cierreDe(total, plan);

  const generar = api.presupuesto.generar.useMutation({
    onSuccess: ({ codigo }) => {
      // El resultado tiene página propia: así el presupuesto emitido se puede
      // compartir, volver a abrir e imprimir, y no vive sólo en esta pestaña.
      router.push(`/presupuesto/codigo/${codigo}`);
    },
  });

  // Cada paso arranca desde arriba. Sin esto, al pasar de un paso largo a uno
  // corto se cae en el medio de la página con el título fuera de cuadro.
  useEffect(() => {
    arriba.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    setDetalleAbierto(false);
    setReclamo(null);
  }, [paso]);

  // Lo que falta y lo que falló son, para quien mira, la misma cosa: "esto no
  // salió". Van por el mismo cartel y sólo puede haber uno.
  const aviso = reclamo ?? generar.error?.message ?? null;
  // Depende de `reset` y no del objeto entero de la mutación: ése se recrea en
  // cada pintado, y con él como dependencia el cierre cambiaría de identidad
  // todo el tiempo y el reloj de los cinco segundos volvería a cero sin parar.
  const reiniciar = generar.reset;
  const cerrarAviso = useCallback(() => {
    setReclamo(null);
    reiniciar();
  }, [reiniciar]);

  function irA(siguiente: number) {
    setPaso(siguiente);
    setMaximo((m) => Math.max(m, siguiente));
  }

  function elegirEvento(e: Evento) {
    // Lo elegido se conserva en lo posible: las coberturas y los complementos
    // son los mismos para los dos eventos, y sólo se caen los momentos que el
    // otro no tiene. Vaciar todo castigaría a quien se equivocó de tarjeta.
    setEvento(e);
    setSel((s) => depurar(e, s));
    irA(1);
  }

  /* ---------------------------------------------------------- selección */

  function alternar(item: Item, multiple: boolean, idsDeLaParte: string[]) {
    setSel((s) => {
      const puesto = s.items.includes(item.id);

      if (puesto) {
        return {
          items: s.items.filter((id) => id !== item.id),
          locaciones: s.locaciones,
        };
      }

      // Con selección única, elegir uno saca a los hermanos de la misma parte.
      const base = multiple
        ? s.items
        : s.items.filter((id) => !idsDeLaParte.includes(id));

      return {
        items: [...base, item.id],
        // Un ítem con locaciones estrena la primera, que es la de precio base:
        // así el total nunca sube por algo que no se eligió.
        locaciones:
          item.locaciones && !s.locaciones[item.id]
            ? { ...s.locaciones, [item.id]: item.locaciones[0]!.id }
            : s.locaciones,
      };
    });
  }

  const ponerLocacion = (itemId: string, locacionId: string) =>
    setSel((s) => ({
      ...s,
      locaciones: { ...s.locaciones, [itemId]: locacionId },
    }));

  /* ------------------------------------------------------------ avanzar */

  /** Qué falta para poder pasar al siguiente paso, o `null` si no falta nada. */
  function queFalta(desde: number): string | null {
    if (desde >= 1 && desde <= 3) {
      const parte = partes[desde - 1];
      if (!parte) return null;

      const elegidos = parte.items.filter((i) => sel.items.includes(i.id));

      if (parte.id === "momentos" && elegidos.length === 0) {
        return "Elegí al menos un momento para cubrir.";
      }
      // Sin fotografía ni video no hay nada que entregar: son los momentos los
      // que dicen cuándo estamos, y las coberturas las que dicen con qué.
      if (parte.id === "coberturas" && elegidos.length === 0) {
        return "Elegí al menos una cobertura: es lo que se entrega después.";
      }
      return null;
    }

    if (desde === PASO_CONTACTO) {
      if (datos.nombre.trim().length < 2) return "Escribí tu nombre.";
      if (datos.celular.replace(/\D/g, "").length < 6)
        return "Escribí un celular al que podamos escribirte.";
      if (!EMAIL.test(datos.email.trim())) return "Revisá el correo.";
      return null;
    }

    if (desde === PASO_FECHA && !fechaEvento) {
      return "Elegí una fecha, aunque sea aproximada.";
    }

    return null;
  }

  function continuar() {
    const falta = queFalta(paso);
    if (falta) {
      setReclamo(falta);
      return;
    }

    if (paso === PASO_PAGO) {
      confirmar();
      return;
    }

    irA(paso + 1);
  }

  function confirmar() {
    if (!evento) return;
    generar.mutate({
      evento,
      items: sel.items,
      locaciones: sel.locaciones,
      nombre: datos.nombre.trim(),
      celular: datos.celular.trim(),
      email: datos.email.trim(),
      quiereCopia: datos.quiereCopia,
      fechaEvento: fechaEvento || undefined,
      plan,
      codigo: retomar?.codigo,
    });
  }

  /* ------------------------------------------------------------- pintar */

  if (!evento || paso === 0) {
    return (
      <div ref={arriba}>
        <PasoEvento elegido={evento} alElegir={elegirEvento} />
      </div>
    );
  }

  const nombreEvento = EVENTOS[evento];

  return (
    <div ref={arriba} className="scroll-mt-20">
      {/* La barra de progreso queda pegada arriba: en un wizard de seis pasos,
          saber cuántos faltan es lo que decide si alguien lo termina. */}
      <div className="sticky top-20 z-20 border-b border-gray-20 bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-[1140px] px-6 py-3 sm:px-10">
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <p className="font-rotulo text-[11px] tracking-[0.14em] text-gray-45 uppercase">
              {nombreEvento.nombre}
            </p>
            <p className="font-rotulo text-[11px] tracking-[0.14em] text-gray-45 uppercase">
              Paso {Math.min(paso, ETIQUETAS.length)} de {ETIQUETAS.length}
            </p>
          </div>
          <Progreso
            cantidad={ETIQUETAS.length}
            actual={paso}
            maximo={maximo}
            alIr={irA}
            etiquetas={ETIQUETAS}
          />
        </div>
      </div>

      {/* El pie mide unos 120px y es fijo: sin este colchón, la última tarjeta
          de cada paso queda debajo del total y no se puede tocar. */}
      <div className="mx-auto max-w-[1140px] px-6 pt-12 pb-[200px] sm:px-10 sm:pt-16">
        {paso <= 3 && partes[paso - 1] && (
          <PasoParte
            parte={partes[paso - 1]!}
            sel={sel}
            alAlternar={alternar}
            alPonerLocacion={ponerLocacion}
          />
        )}

        {paso === PASO_CONTACTO && (
          <PasoContacto datos={datos} alCambiar={setDatos} />
        )}

        {paso === PASO_FECHA && (
          <PasoFecha
            valor={fechaEvento}
            alCambiar={setFechaEvento}
            evento={nombreEvento.posesivo}
          />
        )}

        {paso === PASO_PAGO && (
          <PasoPago
            plan={plan}
            alElegir={setPlan}
            cierre={cierre}
            lineas={lineas}
          />
        )}
      </div>

      {/* ------------------------------------------------------------ pie */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink bg-paper">
        <AvisoFlotante mensaje={aviso} alCerrar={cerrarAviso} />

        {/* Siempre montado y sólo recogido: si se desmontara al cerrar, el
            cierre no se vería —desaparecería de golpe— y la animación existiría
            nada más que al abrir. `inert` lo saca del tabulado y del lector de
            pantalla mientras está recogido, que es lo que ocultar significa
            para quien no lo está mirando. */}
        <div
          className={`despliegue ${detalleAbierto ? "border-b border-gray-20" : ""}`}
          data-abierto={detalleAbierto ? "si" : "no"}
          inert={!detalleAbierto}
        >
          <div>
            <div className="max-h-[46svh] overflow-y-auto px-6 py-5 sm:px-10">
              <div className="mx-auto max-w-[1140px]">
                <Detalle lineas={lineas} total={total} />
              </div>
            </div>
          </div>
        </div>

        <BarraBox total={total} />

        <div className="mx-auto flex max-w-[1140px] items-center gap-4 px-6 py-3.5 sm:px-10">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setDetalleAbierto((v) => !v)}
              aria-expanded={detalleAbierto}
              className="flex cursor-pointer items-center gap-1.5 font-rotulo text-[11px] tracking-[0.08em] text-gray-45 uppercase hover:text-ink"
            >
              {detalleAbierto ? "Ocultar detalles" : "Ver detalles"}
              <IconoBajar
                className={`h-3 w-3 transition-transform ${
                  detalleAbierto ? "" : "rotate-180"
                }`}
              />
            </button>
            <div className="mt-0.5 text-[clamp(1.25rem,4vw,1.6rem)] leading-none font-medium tabular-nums">
              {pesos(total)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => (paso === 1 ? setPaso(0) : setPaso(paso - 1))}
            className="hidden cursor-pointer items-center gap-1.5 font-rotulo text-[11.5px] tracking-[0.06em] text-gray-45 uppercase underline underline-offset-4 hover:text-ink sm:inline-flex"
          >
            <IconoVolver className="h-3 w-3" />
            Volver
          </button>

          <Boton
            onClick={continuar}
            disabled={generar.isPending}
            className="shrink-0"
          >
            {generar.isPending
              ? "Generando…"
              : paso === PASO_PAGO
                ? "Generar presupuesto"
                : "Continuar"}
            {!generar.isPending && <IconoFlecha />}
          </Boton>
        </div>

        {/* En el teléfono "Volver" no entra en la fila del total: baja a su
            propia línea antes que achicarse hasta no poder tocarlo. */}
        <button
          type="button"
          onClick={() => (paso === 1 ? setPaso(0) : setPaso(paso - 1))}
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 border-t border-gray-20 py-2.5 font-rotulo text-[11.5px] tracking-[0.06em] text-gray-45 uppercase hover:text-ink sm:hidden"
        >
          <IconoVolver className="h-3 w-3" />
          Volver
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- paso cero */

function PasoEvento({
  elegido,
  alElegir,
}: {
  elegido: Evento | null;
  alElegir: (e: Evento) => void;
}) {
  return (
    <div className="mx-auto max-w-[1140px] px-6 py-16 sm:px-10 sm:py-24">
      <Cabecera
        rotulo="Simulador de presupuesto"
        titulo="¿Qué estás organizando?"
        bajada="Armá tu cobertura paso a paso y mirá el precio actualizarse mientras elegís. Al final te queda un presupuesto guardado con su código."
      />

      <div className="grid gap-px border border-gray-20 bg-gray-20 sm:grid-cols-2">
        {EVENTOS_ORDEN.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => alElegir(e)}
            aria-current={elegido === e ? "true" : undefined}
            className="group flex min-h-[220px] cursor-pointer flex-col justify-end bg-paper p-8 text-left transition-colors hover:bg-paper-dim sm:min-h-[280px] sm:p-10"
          >
            <h3 className="font-titulo text-[clamp(2rem,5vw,3.2rem)] leading-[0.9] uppercase">
              {EVENTOS[e].nombre}
            </h3>
            <span className="mt-4 inline-flex items-center gap-2 font-rotulo text-[12px] tracking-[0.06em] text-gray-45 uppercase group-hover:text-ink">
              Empezar
              <IconoFlecha />
            </span>
          </button>
        ))}
      </div>

      {!PRECIOS_CONFIRMADOS && <AvisoReferencia className="mt-8" />}
    </div>
  );
}

/* ----------------------------------------------------- pasos del catálogo */

function PasoParte({
  parte,
  sel,
  alAlternar,
  alPonerLocacion,
}: {
  parte: (typeof CATALOGO)[Evento][number];
  sel: Seleccion;
  alAlternar: (item: Item, multiple: boolean, idsDeLaParte: string[]) => void;
  alPonerLocacion: (itemId: string, locacionId: string) => void;
}) {
  const ids = parte.items.map((i) => i.id);

  return (
    <section>
      <Cabecera
        rotulo={parte.rotulo}
        titulo={parte.titulo}
        bajada={parte.bajada}
      />

      <div
        className="grid gap-3"
        role={parte.multiple ? "group" : "radiogroup"}
        aria-label={parte.titulo}
      >
        {parte.items.map((item) => {
          const elegido = sel.items.includes(item.id);
          return (
            <Opcion
              key={item.id}
              tipo={parte.multiple ? "varias" : "una"}
              elegida={elegido}
              alElegir={() => alAlternar(item, parte.multiple, ids)}
              titulo={item.nombre}
              texto={item.texto}
              precio={
                item.locaciones ? `Desde ${pesos(item.precio)}` : pesos(item.precio)
              }
            >
              {item.locaciones && elegido && (
                <div className="border-t border-gray-20 px-5 pt-4 pb-5 sm:px-6">
                  <p className="mb-3 font-rotulo text-[11px] tracking-[0.1em] text-gray-45 uppercase">
                    ¿Dónde lo hacemos?
                  </p>
                  <div
                    className="grid gap-2"
                    role="radiogroup"
                    aria-label={`Locación de ${item.nombre}`}
                  >
                    {item.locaciones.map((l) => {
                      const puesta = sel.locaciones[item.id] === l.id;
                      return (
                        <button
                          key={l.id}
                          type="button"
                          role="radio"
                          aria-checked={puesta}
                          onClick={() => alPonerLocacion(item.id, l.id)}
                          className={`flex cursor-pointer items-start gap-3 border p-3.5 text-left transition-colors ${
                            puesta
                              ? "border-ink bg-paper"
                              : "border-gray-20 hover:border-gray-45"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                              puesta ? "border-ink bg-ink" : "border-gray-45"
                            }`}
                          >
                            {puesta && (
                              <span className="h-1.5 w-1.5 rounded-full bg-paper" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                              <span className="text-[14px]">{l.nombre}</span>
                              <span className="text-[13px] tabular-nums whitespace-nowrap text-gray-45">
                                {l.extra === 0 ? "Sin cargo" : `+ ${pesos(l.extra)}`}
                              </span>
                            </span>
                            <span className="mt-1 block text-[12.5px] leading-snug text-gray-45">
                              {l.texto}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </Opcion>
          );
        })}
      </div>

      {parte.id === "complementos" && !PRECIOS_CONFIRMADOS && (
        <AvisoReferencia className="mt-8" />
      )}
    </section>
  );
}

/* --------------------------------------------------------------- contacto */

function PasoContacto({
  datos,
  alCambiar,
}: {
  datos: Datos;
  alCambiar: (d: Datos) => void;
}) {
  return (
    <section>
      <Cabecera
        rotulo="Paso 4"
        titulo="¿A quién le mandamos esto?"
        bajada="Con estos datos te guardamos el presupuesto y te podemos escribir si tenés alguna duda."
      />

      <div className="grid max-w-[520px] gap-5">
        <Campo
          label="Nombre y apellido"
          value={datos.nombre}
          autoComplete="name"
          onChange={(e) => alCambiar({ ...datos, nombre: e.target.value })}
          placeholder="Ana Pérez"
        />
        <Campo
          label="Celular"
          value={datos.celular}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          onChange={(e) => alCambiar({ ...datos, celular: e.target.value })}
          placeholder="351 000 0000"
        />
        <Campo
          label="Correo electrónico"
          value={datos.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          onChange={(e) => alCambiar({ ...datos, email: e.target.value })}
          placeholder="ana@correo.com"
        />

        <label className="flex cursor-pointer items-start gap-3 border border-gray-20 p-4">
          <input
            type="checkbox"
            checked={datos.quiereCopia}
            onChange={(e) =>
              alCambiar({ ...datos, quiereCopia: e.target.checked })
            }
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-ink)]"
          />
          <span className="text-[14px] leading-relaxed">
            Enviame copia del presupuesto por correo y novedades por WhatsApp.
          </span>
        </label>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ fecha */

function PasoFecha({
  valor,
  alCambiar,
  evento,
}: {
  valor: string;
  alCambiar: (v: string) => void;
  evento: string;
}) {
  return (
    <section>
      <Cabecera
        rotulo="Paso 5"
        titulo="¿Qué día es?"
        bajada={`La fecha de ${evento}. Si todavía no tenés confirmado el salón o el día, elegí una aproximada: sirve igual para saber si tenemos equipo disponible.`}
      />

      <div className="max-w-[320px]">
        <CampoFecha
          label="Fecha del evento"
          valor={valor}
          alCambiar={alCambiar}
          hint="Se puede cambiar después."
        />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- pago */

function PasoPago({
  plan,
  alElegir,
  cierre,
  lineas,
}: {
  plan: string;
  alElegir: (id: string) => void;
  cierre: ReturnType<typeof cierreDe>;
  lineas: ReturnType<typeof lineasDe>;
}) {
  return (
    <section>
      <Cabecera
        rotulo="Paso 6"
        titulo="Reserva y forma de pago"
        bajada="La reserva bloquea la fecha y congela el precio: a partir de ahí, lo que elegiste no cambia de valor. No es un cargo aparte, se descuenta del total."
      />

      {/* La reserva primero y sola: es lo único obligatorio de este paso y lo
          que hay que entender antes de mirar las cuotas. */}
      <div className="mb-8 border border-ink p-6 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div>
            <p className="font-rotulo text-[11.5px] tracking-[0.1em] text-gray-45 uppercase">
              Reserva
            </p>
            <p className="mt-1 max-w-[42ch] text-[13.5px] leading-relaxed text-gray-70">
              Se abona una sola vez para bloquear la fecha. Se descuenta del
              total.
            </p>
          </div>
          <p className="text-[clamp(1.6rem,5vw,2.2rem)] leading-none font-medium tabular-nums">
            {pesos(cierre.reserva)}
          </p>
        </div>
      </div>

      <p className="mb-4 font-rotulo text-[11.5px] tracking-[0.1em] text-gray-45 uppercase">
        El saldo de {pesos(cierre.saldo)}
      </p>

      <div className="grid gap-3" role="radiogroup" aria-label="Forma de pago">
        {PLANES.map((p) => {
          const elegido = p.id === plan;
          const cuenta = cierreDe(cierre.total, p.id);
          return (
            <Opcion
              key={p.id}
              tipo="una"
              elegida={elegido}
              alElegir={() => alElegir(p.id)}
              titulo={p.destacado ? `${p.nombre} — más elegido` : p.nombre}
              texto={p.texto}
              precio={
                p.cuotas === 1 ? (
                  pesos(cuenta.saldoFinanciado)
                ) : (
                  <>
                    {p.cuotas} × {pesos(cuenta.porCuota)}
                  </>
                )
              }
            />
          );
        })}
      </div>

      {/* El cierre completo, sin tener que abrir el detalle del pie: es el
          último paso antes de emitir y acá sí hay que ver todo junto. */}
      <div className="mt-10 border-t border-ink pt-6">
        <Detalle lineas={lineas} total={cierre.total} />

        <dl className="mt-5 space-y-2 text-[14px]">
          <Renglon rotulo="Reserva" valor={pesos(cierre.reserva)} />
          <Renglon
            rotulo={
              cierre.cuotas === 1
                ? "Saldo (pago único)"
                : `Saldo en ${cierre.cuotas} cuotas`
            }
            valor={
              cierre.cuotas === 1
                ? pesos(cierre.saldoFinanciado)
                : `${cierre.cuotas} × ${pesos(cierre.porCuota)}`
            }
          />
          {cierre.ajuste !== 0 && (
            <Renglon
              rotulo={cierre.ajuste < 0 ? "Descuento" : "Interés"}
              valor={`${cierre.ajuste < 0 ? "−" : "+"} ${pesos(Math.abs(cierre.ajuste))}`}
              tenue
            />
          )}
          <div className="flex items-baseline justify-between gap-4 border-t border-gray-20 pt-2.5">
            <dt className="font-rotulo text-[11.5px] tracking-[0.08em] uppercase">
              Total a pagar
            </dt>
            <dd className="text-[19px] font-medium tabular-nums">
              {pesos(cierre.aPagar)}
            </dd>
          </div>
        </dl>
      </div>

      {!PRECIOS_CONFIRMADOS && <AvisoReferencia className="mt-8" />}
    </section>
  );
}

function Renglon({
  rotulo,
  valor,
  tenue = false,
}: {
  rotulo: string;
  valor: string;
  tenue?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 ${
        tenue ? "text-gray-45" : ""
      }`}
    >
      <dt>{rotulo}</dt>
      <dd className="tabular-nums">{valor}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ avisos */

/**
 * Mientras los precios del catálogo no sean los definitivos, se dice.
 *
 * Desaparece solo al poner `PRECIOS_CONFIRMADOS` en `true`. Un simulador que
 * devuelve números provisorios sin avisar produce una conversación incómoda
 * más adelante, y el que la tiene que tener no es quien escribió el archivo.
 */
export function AvisoReferencia({ className = "" }: { className?: string }) {
  return (
    <p
      className={`flex items-start gap-2 border border-dashed border-gray-20 p-4 text-[13px] leading-relaxed text-gray-70 ${className}`}
    >
      <IconoAlerta className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Los valores son de referencia y se confirman al contactarte. Lo que
        armes acá queda guardado igual, con su código.
      </span>
    </p>
  );
}
