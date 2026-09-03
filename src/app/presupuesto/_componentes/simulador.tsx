"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { CampoFecha } from "~/app/_components/campo-fecha";
import {
  IconoAlerta,
  IconoBajar,
  IconoTilde,
  IconoFlecha,
  IconoVolver,
} from "~/app/_components/iconos";
import { Boton, Campo } from "~/app/_components/ui";
import {
  EVENTOS,
  EVENTOS_ORDEN,
  PLANES,
  mesesHasta,
  planesDisponibles,
  SELECCION_VACIA,
  cierreDe,
  depurar,
  desdeDe,
  lineasDe,
  sinCobertura,
  totalDe,
  type Evento,
  type Item,
  type Parametros,
  type Parte,
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

/**
 * Los pasos que llenan el presupuesto — los que tienen punto de progreso.
 *
 * Las coberturas eran el paso dos y ahora viven adentro del uno, como casillas
 * debajo del momento que se elige. Antes se pedía "fotografía" una vez para
 * todo el evento y eso cobraba lo mismo por cubrir el civil que por cubrir ocho
 * horas de fiesta; puestas adentro de cada momento, cada una tiene su precio y
 * de paso se contesta dónde se contesta bien: eligiendo la fiesta uno ya está
 * pensando con qué la quiere.
 */
type IdPaso = "momentos" | "complementos" | "contacto" | "fecha" | "pago";

const ETIQUETA: Record<IdPaso, string> = {
  momentos: "Momentos",
  complementos: "Complementos",
  contacto: "Contacto",
  fecha: "Fecha",
  pago: "Pago",
};

const PASOS: IdPaso[] = [
  "momentos",
  "complementos",
  "contacto",
  "fecha",
  "pago",
];

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
  catalogos,
  parametros,
  inicial = null,
  retomar = null,
}: {
  /**
   * Los dos catálogos, ya leídos de la base por el servidor.
   *
   * Vienen los dos y no sólo el del evento elegido porque el paso cero deja
   * cambiar de idea, y pedirle otro al servidor en ese momento metería una
   * espera en el medio de una decisión que dura un segundo. Son dos listas de
   * texto: pesan nada.
   */
  catalogos: Record<Evento, Parte[]>;
  parametros: Parametros;
  /** El evento con el que se entra, cuando se viene de una categoría. */
  inicial?: Evento | null;
  /** Un presupuesto ya emitido que se vuelve a abrir para modificarlo. */
  retomar?: Retomar | null;
}) {
  const router = useRouter();

  const [evento, setEvento] = useState<Evento | null>(
    retomar?.evento ?? inicial,
  );
  /** `null` es el paso cero: elegir el evento. */
  const [paso, setPaso] = useState<IdPaso | null>(evento ? "momentos" : null);
  /**
   * Por dónde ya pasó, para habilitar los puntos del progreso.
   *
   * Es un conjunto de nombres y no un número porque la lista de pasos cambia de
   * largo: con un índice, elegir el book correría todo un lugar y lo ya visitado
   * pasaría a señalar otra cosa.
   */
  const [vistos, setVistos] = useState<Set<IdPaso>>(new Set(["momentos"]));

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
  /**
   * Todavía no hay fecha, y es una respuesta y no una omisión.
   *
   * Antes el paso exigía una fecha sí o sí, aunque fuera aproximada. Quien
   * está averiguando antes de tener salón no tiene ni aproximada, y lo que
   * hacía era inventar una para poder seguir, que es peor que ninguna: la
   * hoja después dice una fecha que nadie dijo.
   *
   * Un presupuesto retomado sin fecha arranca con esto marcado, para que no
   * vuelva a pedirla.
   */
  const [sinFecha, setSinFecha] = useState(
    Boolean(retomar && !retomar.fechaEvento),
  );
  const [plan, setPlan] = useState(retomar?.plan ?? "3");

  const [detalleAbierto, setDetalleAbierto] = useState(false);
  /** Se muestra recién al intentar avanzar: nadie quiere un error antes de escribir. */
  const [reclamo, setReclamo] = useState<string | null>(null);

  const arriba = useRef<HTMLDivElement>(null);

  const partes = useMemo(
    () => (evento ? catalogos[evento] : []),
    [evento, catalogos],
  );
  const lineas = useMemo(() => lineasDe(partes, sel), [partes, sel]);

  /** Lo elegido que además tiene dónde elegirse. Es lo que abre el paso. */
  const conLocacion = useMemo(
    () =>
      partes
        .flatMap((p) => p.items)
        .filter((i) => sel.items.includes(i.id) && i.locaciones?.length),
    [partes, sel.items],
  );

  const indice = paso ? PASOS.indexOf(paso) : -1;
  const total = totalDe(lineas);
  const cierre = cierreDe(total, plan, parametros);

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

  function irA(siguiente: IdPaso) {
    setPaso(siguiente);
    setVistos((v) => new Set(v).add(siguiente));
  }

  function elegirEvento(e: Evento) {
    // Lo elegido se conserva en lo posible: las coberturas y los complementos
    // son los mismos para los dos eventos, y sólo se caen los momentos que el
    // otro no tiene. Vaciar todo castigaría a quien se equivocó de tarjeta.
    setEvento(e);
    setSel((s) => depurar(catalogos[e], s));
    irA("momentos");
  }

  /* ---------------------------------------------------------- selección */

  function alternar(item: Item, multiple: boolean, idsDeLaParte: string[]) {
    setSel((s) => {
      const puesto = s.items.includes(item.id);

      if (puesto) {
        return { ...s, items: s.items.filter((id) => id !== item.id) };
      }

      // Con selección única, elegir uno saca a los hermanos de la misma parte.
      const base = multiple
        ? s.items
        : s.items.filter((id) => !idsDeLaParte.includes(id));

      return {
        ...s,
        items: [...base, item.id],
        // Un ítem con locaciones estrena la primera, que es la de precio base:
        // así el total nunca sube por algo que no se eligió.
        locaciones:
          item.locaciones && !s.locaciones[item.id]
            ? { ...s.locaciones, [item.id]: item.locaciones[0]!.id }
            : s.locaciones,
        // Las coberturas arrancan vacías a propósito: son la decisión del paso
        // —con qué se cubre— y darle una tildada de fábrica sería contestarla
        // por él y hacerle pagar algo que no eligió.
        coberturas: s.coberturas,
      };
    });
  }

  const ponerLocacion = (itemId: string, locacionId: string) =>
    setSel((s) => ({
      ...s,
      locaciones: { ...s.locaciones, [itemId]: locacionId },
    }));

  const alternarCobertura = (itemId: string, coberturaId: string) =>
    setSel((s) => {
      const puestas = s.coberturas[itemId] ?? [];
      return {
        ...s,
        coberturas: {
          ...s.coberturas,
          [itemId]: puestas.includes(coberturaId)
            ? puestas.filter((c) => c !== coberturaId)
            : [...puestas, coberturaId],
        },
      };
    });

  /* ------------------------------------------------------------ avanzar */

  /** Qué falta para poder pasar al siguiente paso, o `null` si no falta nada. */
  function queFalta(desde: IdPaso): string | null {
    if (desde === "momentos" || desde === "complementos") {
      const parte = partes.find((p) => p.id === desde);
      if (!parte) return null;

      const elegidos = parte.items.filter((i) => sel.items.includes(i.id));

      if (parte.id === "momentos" && elegidos.length === 0) {
        return "Elegí al menos un momento para cubrir.";
      }

      // Un momento sin foto ni video no es nada contratable: el equipo estaría
      // ahí parado. Se nombra el que falta —pueden ser varios y el reclamo
      // genérico obliga a buscar cuál.
      const faltan = sinCobertura([parte], sel);
      if (faltan[0]) {
        return `Elegí con qué cubrimos ${faltan[0].nombre.toLowerCase()}: foto o video.`;
      }

      // La ubicación se pregunta dentro de este paso, así que se valida acá.
      if (desde === "complementos") {
        const sinLugar = conLocacion.find((i) => !sel.locaciones[i.id]);
        if (sinLugar) {
          return `Elegí dónde hacemos ${sinLugar.nombre.toLowerCase()}.`;
        }
      }
      return null;
    }

    if (desde === "contacto") {
      if (datos.nombre.trim().length < 2) return "Escribí tu nombre.";
      if (datos.celular.replace(/\D/g, "").length < 6)
        return "Escribí un celular al que podamos escribirte.";
      if (!EMAIL.test(datos.email.trim())) return "Revisá el correo.";
      return null;
    }

    if (desde === "fecha" && !fechaEvento && !sinFecha) {
      return "Elegí una fecha, aunque sea aproximada, o marcá que todavía no la tenés.";
    }

    return null;
  }

  function continuar() {
    if (!paso) return;

    const falta = queFalta(paso);
    if (falta) {
      setReclamo(falta);
      return;
    }

    if (paso === "pago") {
      confirmar();
      return;
    }

    const siguiente = PASOS[indice + 1];
    if (siguiente) irA(siguiente);
  }

  /** Atrás. Desde el primer paso se sale al cero: volver a elegir el evento. */
  function volver() {
    if (indice <= 0) return setPaso(null);
    setPaso(PASOS[indice - 1] ?? null);
  }

  function confirmar() {
    if (!evento) return;
    generar.mutate({
      evento,
      items: sel.items,
      locaciones: sel.locaciones,
      coberturas: sel.coberturas,
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

  if (!evento || paso === null) {
    return (
      <div ref={arriba}>
        <PasoEvento
          elegido={evento}
          alElegir={elegirEvento}
          preciosConfirmados={parametros.preciosConfirmados}
        />
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
              Paso {indice + 1} de {PASOS.length}
            </p>
          </div>
          <Progreso
            cantidad={PASOS.length}
            actual={indice + 1}
            // El punto se puede tocar si ya se pasó por ese paso. Con la lista
            // cambiando de largo, "hasta dónde llegué" es el más lejano de los
            // visitados que todavía existe.
            maximo={PASOS.reduce((m, id, i) => (vistos.has(id) ? i + 1 : m), 1)}
            alIr={(n) => {
              const destino = PASOS[n - 1];
              if (destino) irA(destino);
            }}
            etiquetas={PASOS.map((id) => ETIQUETA[id])}
          />
        </div>
      </div>

      {/* El pie mide unos 120px y es fijo: sin este colchón, la última tarjeta
          de cada paso queda debajo del total y no se puede tocar. */}
      <div className="mx-auto max-w-[1140px] px-6 pt-12 pb-[200px] sm:px-10 sm:pt-16">
        {(paso === "momentos" || paso === "complementos") &&
          partes.find((pa) => pa.id === paso) && (
            <PasoParte
              parte={partes.find((pa) => pa.id === paso)!}
              sel={sel}
              alAlternar={alternar}
              alAlternarCobertura={alternarCobertura}
              preciosConfirmados={parametros.preciosConfirmados}
              // La ubicación va acá y no en un paso propio: es una decisión
              // sobre algo que ya está contratado, no otra cosa que sumar, y
              // un paso entero para una sola pregunta se siente como un
              // trámite. Va primero porque cambia el resultado del book, que
              // pesa más que cualquier agregado de los de abajo.
              antes={
                paso === "complementos" && conLocacion.length > 0 ? (
                  <BloqueLocaciones
                    items={conLocacion}
                    sel={sel}
                    alPonerLocacion={ponerLocacion}
                  />
                ) : null
              }
            />
          )}

        {paso === "contacto" && (
          <PasoContacto datos={datos} alCambiar={setDatos} />
        )}

        {paso === "fecha" && (
          <PasoFecha
            valor={fechaEvento}
            alCambiar={setFechaEvento}
            sinFecha={sinFecha}
            alCambiarSinFecha={(v) => {
              setSinFecha(v);
              // Marcar que no hay fecha la borra: que quede una cargada de
              // antes y a la vez el aviso de que no existe es contradecirse.
              if (v) setFechaEvento("");
            }}
            evento={nombreEvento.posesivo}
          />
        )}

        {paso === "pago" && (
          <PasoPago
            plan={plan}
            alElegir={setPlan}
            cierre={cierre}
            lineas={lineas}
            parametros={parametros}
            fechaEvento={sinFecha ? null : fechaEvento || null}
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

        <BarraBox total={total} parametros={parametros} />

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
            onClick={volver}
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
              : paso === "pago"
                ? "Generar presupuesto"
                : "Continuar"}
            {!generar.isPending && <IconoFlecha />}
          </Boton>
        </div>

        {/* En el teléfono "Volver" no entra en la fila del total: baja a su
            propia línea antes que achicarse hasta no poder tocarlo. */}
        <button
          type="button"
          onClick={volver}
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
  preciosConfirmados,
}: {
  elegido: Evento | null;
  alElegir: (e: Evento) => void;
  preciosConfirmados: boolean;
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

      {!preciosConfirmados && <AvisoReferencia className="mt-8" />}
    </div>
  );
}

/* ----------------------------------------------------- pasos del catálogo */

function PasoParte({
  parte,
  sel,
  alAlternar,
  alAlternarCobertura,
  preciosConfirmados,
  antes,
}: {
  parte: Parte;
  sel: Seleccion;
  alAlternar: (item: Item, multiple: boolean, idsDeLaParte: string[]) => void;
  alAlternarCobertura: (itemId: string, coberturaId: string) => void;
  preciosConfirmados: boolean;
  /** Lo que va entre el encabezado y la grilla. Hoy, dónde se hace el book. */
  antes?: ReactNode;
}) {
  const ids = parte.items.map((i) => i.id);

  return (
    <section>
      <Cabecera
        rotulo={parte.rotulo}
        titulo={parte.titulo}
        bajada={parte.bajada}
      />

      {antes}

      {/* Una en el teléfono, dos desde `sm` y tres desde `lg`. La caja del
          wizard corta en 1140, así que en una pantalla de escritorio la tercera
          columna no achica las tarjetas hasta lo ilegible: quedan de 345
          píxeles contra los 524 de dos, que para una foto apaisada y tres
          renglones alcanza de sobra. Y es lo que la grilla vino a hacer:
          cuantas más entren de una, mejor se comparan. */}
      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
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
              imagen={item.imagen}
              // "Desde" cuando hay algo que elegir abajo que puede subirlo, y
              // el número es el piso real —con la cobertura más barata ya
              // adentro—, no el precio pelado del ítem. En los momentos ese
              // precio pelado hoy es cero, así que mostrarlo sería anunciar que
              // la fiesta sale nada.
              precio={
                item.locaciones || item.coberturas
                  ? `Desde ${pesos(desdeDe(item))}`
                  : pesos(item.precio)
              }
            >
              {/* Con qué se cubre este momento. Aparece recién al elegirlo:
                  antes de eso es una pregunta sobre algo que todavía no está
                  en el presupuesto. */}
              {item.coberturas && elegido && (
                <div className="border-t border-gray-20 px-4 pt-3 pb-4">
                  <p className="mb-3 font-rotulo text-[11px] tracking-[0.1em] text-gray-45 uppercase">
                    ¿Con qué lo cubrimos?
                  </p>
                  {/* La tarjeta es media pantalla, o un tercio en escritorio,
                      así que las casillas van una debajo de otra: dos columnas
                      ahí dejan el nombre partido en dos renglones. */}
                  <div
                    className="grid gap-2"
                    role="group"
                    aria-label={`Coberturas de ${item.nombre}`}
                  >
                    {item.coberturas.map((c) => {
                      const puesta = (sel.coberturas[item.id] ?? []).includes(
                        c.id,
                      );
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="checkbox"
                          aria-checked={puesta}
                          onClick={() => alAlternarCobertura(item.id, c.id)}
                          className={`flex cursor-pointer items-start gap-2.5 border p-3 text-left transition-colors ${
                            puesta
                              ? "border-ink bg-paper"
                              : "border-gray-20 hover:border-gray-45"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border ${
                              puesta
                                ? "border-ink bg-ink text-paper"
                                : "border-gray-45"
                            }`}
                          >
                            {puesta && <IconoTilde className="h-2.5 w-2.5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13.5px] leading-tight">
                              {c.nombre}
                            </span>
                            <span className="mt-1 block text-[13px] tabular-nums text-gray-45">
                              + {pesos(c.extra)}
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

      {parte.id === "complementos" && !preciosConfirmados && (
        <AvisoReferencia className="mt-8" />
      )}
    </section>
  );
}

/* ------------------------------------------------------------- locaciones */

/**
 * Dónde se hace cada cosa que tiene dónde hacerse.
 *
 * Era un desplegable adentro de la tarjeta del momento. Metido ahí competía con
 * la decisión de ese paso —qué momentos van y con qué— y encima escondía lo que
 * más cambia el resultado del book: la locación no es un detalle de
 * configuración, es de qué van a ser las fotos.
 *
 * Vive dentro del paso de los complementos y no en uno propio: es una decisión
 * sobre algo que ya está contratado, y un paso entero para una sola pregunta se
 * siente como un trámite. Va primero de ese paso porque pesa más que cualquiera
 * de los agregados que vienen abajo.
 *
 * Aparece sólo si hay algo que preguntar. Hoy eso es el book, pero la regla sale
 * del catálogo, así que si mañana otro ítem estrena locaciones aparece solo.
 */
function BloqueLocaciones({
  items,
  sel,
  alPonerLocacion,
}: {
  items: Item[];
  sel: Seleccion;
  alPonerLocacion: (itemId: string, locacionId: string) => void;
}) {
  return (
    <div className="mb-10 border-b border-gray-20 pb-9">
      <h3 className="font-titulo text-[clamp(1.4rem,3.4vw,2rem)] leading-tight uppercase">
        ¿Dónde lo hacemos?
      </h3>
      <p className="mt-2 max-w-[56ch] text-[14px] leading-relaxed text-gray-70">
        El lugar cambia la luz, el tiempo que lleva y lo que se ve detrás. Es lo
        que más define de qué van a ser las fotos.
      </p>

      {items.map((item) => (
        <div key={item.id} className="mt-6">
          {/* Con un solo ítem el subtítulo sobra; con dos hace falta saber de
              cuál se está eligiendo el lugar. */}
          {items.length > 1 && (
            <p className="mb-3 font-rotulo text-[11.5px] tracking-[0.1em] text-gray-45 uppercase">
              {item.nombre}
            </p>
          )}

          <div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            role="radiogroup"
            aria-label={`Dónde hacemos ${item.nombre}`}
          >
            {(item.locaciones ?? []).map((l) => (
              <Opcion
                key={l.id}
                tipo="una"
                elegida={sel.locaciones[item.id] === l.id}
                alElegir={() => alPonerLocacion(item.id, l.id)}
                titulo={l.nombre}
                texto={l.texto}
                imagen={l.imagen}
                precio={l.extra === 0 ? "Sin cargo" : `+ ${pesos(l.extra)}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
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
  sinFecha,
  alCambiarSinFecha,
  evento,
}: {
  valor: string;
  alCambiar: (v: string) => void;
  sinFecha: boolean;
  alCambiarSinFecha: (v: boolean) => void;
  evento: string;
}) {
  return (
    <section>
      <Cabecera
        rotulo="Paso 5"
        titulo="¿Qué día es?"
        bajada={`La fecha de ${evento}. Si todavía no tenés confirmado el salón o el día, elegí una aproximada: sirve igual para saber si tenemos equipo disponible.`}
      />

      <div className="grid max-w-[420px] gap-5">
        {/* El campo se va cuando no hay fecha, no se apaga. Un campo apagado
            con una fecha adentro sigue diciendo esa fecha; sin el campo queda
            claro que la respuesta es la casilla. */}
        {!sinFecha && (
          <div className="max-w-[320px]">
            <CampoFecha
              label="Fecha del evento"
              valor={valor}
              alCambiar={alCambiar}
              hint="Se puede cambiar después."
            />
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-3 border border-gray-20 p-4">
          <input
            type="checkbox"
            checked={sinFecha}
            onChange={(e) => alCambiarSinFecha(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-ink)]"
          />
          <span className="text-[14px] leading-relaxed">
            Todavía no tengo fecha.
            <span className="mt-1 block text-[12.5px] text-gray-45">
              El presupuesto sale igual, con la fecha a confirmar. Sin fecha se
              reserva con el pago único; cuando la tengas se arma el plan de
              cuotas.
            </span>
          </span>
        </label>
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
  parametros,
  fechaEvento,
}: {
  plan: string;
  alElegir: (id: string) => void;
  cierre: ReturnType<typeof cierreDe>;
  lineas: ReturnType<typeof lineasDe>;
  parametros: Parametros;
  /** Sin fecha es null, y con eso sólo se ofrece el pago único. */
  fechaEvento: string | null;
}) {
  /**
   * Sólo los planes que llegan antes del evento.
   *
   * Si el que estaba elegido quedó afuera (se cambió la fecha después de
   * elegir), se pasa al más largo de los que quedan. Es un efecto y no un
   * cálculo en el render porque cambia el estado del padre.
   */
  const planes = planesDisponibles(fechaEvento);
  const meses = mesesHasta(fechaEvento);
  useEffect(() => {
    if (!planes.some((p) => p.id === plan)) {
      alElegir(planes[planes.length - 1]!.id);
    }
  }, [planes, plan, alElegir]);
  return (
    <section>
      <Cabecera
        rotulo="Paso 6"
        titulo="Reserva y forma de pago"
        bajada="La reserva bloquea la fecha y congela el precio: a partir de ahí, lo que elegiste no cambia de valor. No es un cargo aparte, se descuenta del total."
      />

      {/* El total partido en dos, que es de lo que trata el paso: esto se abona
          ahora y aquello queda. Antes la reserva iba en una caja sola y el saldo
          asomaba abajo como un rótulo suelto —"El saldo de $2.240.000"— que no
          se leía como la otra mitad de nada. Juntos y separados por una línea
          se entiende la cuenta sin explicarla. */}
      <div className="mb-9 grid gap-px border border-ink bg-ink sm:grid-cols-2">
        <div className="bg-paper p-6 sm:p-7">
          <p className="font-rotulo text-[11px] tracking-[0.12em] text-gray-45 uppercase">
            Reserva · ahora
          </p>
          <p className="mt-2 text-[clamp(1.6rem,4.4vw,2.1rem)] leading-none font-medium tabular-nums">
            {pesos(cierre.reserva)}
          </p>
          <p className="mt-2.5 max-w-[34ch] text-[13.5px] leading-relaxed text-gray-70">
            Bloquea la fecha y congela el precio. No es un cargo aparte: se
            descuenta del total.
          </p>
        </div>

        <div className="bg-paper p-6 sm:p-7">
          <p className="font-rotulo text-[11px] tracking-[0.12em] text-gray-45 uppercase">
            Saldo · después
          </p>
          <p className="mt-2 text-[clamp(1.6rem,4.4vw,2.1rem)] leading-none font-medium tabular-nums">
            {pesos(cierre.saldo)}
          </p>
          <p className="mt-2.5 max-w-[34ch] text-[13.5px] leading-relaxed text-gray-70">
            Lo que queda del total una vez abonada la reserva. Elegí abajo en
            cuántas veces.
          </p>
        </div>
      </div>

      <p className="mb-3 font-rotulo text-[11.5px] tracking-[0.1em] text-gray-45 uppercase">
        ¿En cuántas veces?
      </p>

      {/* Filas y no tarjetas. Las tarjetas de este simulador son las del
          catálogo: foto adelante, porque ahí lo que decide es ver el trabajo.
          Un plan de pago no tiene nada que mostrar —son cuatro variantes del
          mismo número— y lo que se hace con ellas es comparar montos, que se
          compara mejor en una columna alineada que en cuatro cajas. */}
      {planes.length < PLANES.length && (
        <p className="nota mb-3 max-w-[60ch] text-[13px]">
          {meses === null
            ? "Sin fecha no hay contra qué armar cuotas: se reserva con el pago único y, cuando esté la fecha, se arma el plan."
            : meses === 0
              ? "Con el evento a menos de un mes, la única forma es el pago único."
              : `Con el evento a ${meses} ${meses === 1 ? "mes" : "meses"}, las cuotas tienen que terminar antes: por eso hay menos opciones.`}
        </p>
      )}

      <div
        className="grid gap-px border border-gray-20 bg-gray-20"
        role="radiogroup"
        aria-label="Forma de pago"
      >
        {planes.map((p) => (
          <FilaPlan
            key={p.id}
            plan={p}
            elegido={p.id === plan}
            cuenta={cierreDe(cierre.total, p.id, parametros)}
            alElegir={() => alElegir(p.id)}
          />
        ))}
      </div>

      {/* El cierre completo, sin tener que abrir el detalle del pie: es el
          último paso antes de emitir y acá sí hay que ver todo junto.

          Repite la reserva y el saldo que están arriba, y no es duplicación:
          arriba es cómo se parte el total antes de elegir plan, acá es cómo
          queda después. Cuando el plan tiene descuento o interés los dos saldos
          ni siquiera son el mismo número. */}
      <div className="mt-10 border-t border-ink pt-6">
        <p className="mb-4 font-rotulo text-[11.5px] tracking-[0.1em] text-gray-45 uppercase">
          Cómo queda
        </p>

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

      {!parametros.preciosConfirmados && <AvisoReferencia className="mt-8" />}
    </section>
  );
}

/**
 * Un plan de pago, como fila.
 *
 * El estado elegido invierte tinta y papel, que es el "esto está puesto" más
 * fuerte que tiene la marca y el que corresponde acá: de los cuatro se elige
 * uno, y con un fondo apenas más oscuro había que comparar cuatro grises para
 * saber cuál. En el catálogo la marca es suave porque ahí se eligen varios y
 * cuatro tarjetas invertidas serían una mancha.
 *
 * El monto va a la derecha y en cifras tabulares: las cuatro filas alinean sus
 * números en la misma columna, y esa columna es la comparación que la persona
 * vino a hacer.
 *
 * Debajo del monto, lo que el plan le hace al saldo. Estaba sólo en el resumen
 * del pie y para el plan ya elegido, así que el descuento del pago único —que
 * es el argumento del plan— no se veía hasta después de elegirlo.
 */
function FilaPlan({
  plan,
  elegido,
  cuenta,
  alElegir,
}: {
  plan: (typeof PLANES)[number];
  elegido: boolean;
  cuenta: ReturnType<typeof cierreDe>;
  alElegir: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={elegido}
      onClick={alElegir}
      className={`flex w-full cursor-pointer items-center gap-4 p-4 text-left transition-colors sm:px-5 ${
        elegido ? "bg-ink text-paper" : "bg-paper hover:bg-paper-dim"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          elegido ? "border-paper bg-paper" : "border-gray-45 bg-paper"
        }`}
      >
        {elegido && <span className="h-2 w-2 rounded-full bg-ink" />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="text-[15px]">{plan.nombre}</span>
          {plan.destacado && (
            <span
              className={`border px-1.5 py-px font-rotulo text-[9.5px] tracking-[0.1em] uppercase ${
                elegido
                  ? "border-paper/50 text-paper/80"
                  : "border-gray-45 text-gray-45"
              }`}
            >
              Más elegido
            </span>
          )}
        </span>
        <span
          className={`mt-1 block text-[13px] leading-snug ${
            elegido ? "text-paper/75" : "text-gray-70"
          }`}
        >
          {plan.texto}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className="block text-[15px] tabular-nums whitespace-nowrap">
          {plan.cuotas === 1
            ? pesos(cuenta.saldoFinanciado)
            : `${plan.cuotas} × ${pesos(cuenta.porCuota)}`}
        </span>
        {cuenta.ajuste !== 0 && (
          <span
            className={`mt-0.5 block text-[12px] tabular-nums whitespace-nowrap ${
              elegido ? "text-paper/70" : "text-gray-45"
            }`}
          >
            {cuenta.ajuste < 0 ? "−" : "+"} {pesos(Math.abs(cuenta.ajuste))}
          </span>
        )}
      </span>
    </button>
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
