"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  IconoAlerta,
  IconoBajar,
  IconoMas,
  IconoPapelera,
  IconoTilde,
  IconoVolver,
} from "~/app/_components/iconos";
import { Modal } from "~/app/_components/modal";
import {
  Boton,
  BotonTexto,
  Campo,
  CampoTexto,
  Encabezado,
  Etiqueta,
  Vacio,
} from "~/app/_components/ui";
import {
  ICONOS_PAQUETE,
  IconoDePaquete,
  NOMBRE_ICONO,
  type IconoPaquete,
} from "~/app/_datos/paquetes";
import {
  EVENTOS,
  EVENTOS_ORDEN,
  SELECCION_VACIA,
  lineasDe,
  sinCobertura,
  totalDe,
  type Evento,
  type Parte,
  type Seleccion,
} from "~/app/_datos/presupuesto";
import { Detalle } from "~/app/presupuesto/_componentes/piezas";
import { pesos } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

/**
 * Los presupuestos prearmados, desde el panel.
 *
 * Un paquete es una selección del catálogo con nombre, texto e ícono: lo que
 * Halley le ofrece como "elegí éste" a quien no quiere armar ítem por ítem. Se
 * arma acá marcando ítems del catálogo que ya existe, con las mismas reglas que
 * el wizard le impone a la persona: al menos un momento, cada momento con foto
 * o video, y una locación donde haga falta. Un paquete que no las cumple no se
 * puede guardar, porque sería ofrecer algo que al tocar "generar" va a fallar.
 *
 * El precio no se escribe: se calcula en vivo contra el catálogo, con las
 * mismas funciones que usa el wizard. Lo que el panel muestra a la derecha
 * mientras se arma es exactamente lo que la persona va a ver en la tarjeta.
 */

type PaqueteAdmin = RouterOutputs["paquete"]["listar"][number];
type Catalogo = RouterOutputs["catalogo"]["listar"];

/**
 * El catálogo del panel, en la forma que entienden las funciones del wizard.
 *
 * El panel recibe los ítems con su id de base y su clave; el wizard trabaja por
 * clave, que es lo que queda escrito en un presupuesto emitido y lo que el
 * paquete guarda. Sólo lo activo: es lo que la persona va a poder contratar, y
 * un paquete armado con un ítem apagado ofrecería algo que no está a la venta.
 */
function partesDe(grupos: Catalogo): Parte[] {
  return grupos.map((g) => ({
    id: g.parte,
    rotulo: "",
    titulo: ROTULO[g.parte],
    bajada: "",
    multiple: true,
    items: g.items
      .filter((i) => i.activo)
      .map((i) => ({
        id: i.clave,
        nombre: i.nombre,
        texto: i.texto,
        precio: i.precio,
        imagen: i.imagen,
        ...(i.locaciones.length > 0
          ? {
              locaciones: i.locaciones.map((o) => ({
                id: o.clave,
                nombre: o.nombre,
                texto: o.texto,
                extra: o.extra,
              })),
            }
          : {}),
        ...(i.coberturas.length > 0
          ? {
              coberturas: i.coberturas.map((o) => ({
                id: o.clave,
                nombre: o.nombre,
                texto: o.texto,
                extra: o.extra,
              })),
            }
          : {}),
      })),
  }));
}

const ROTULO: Record<Parte["id"], string> = {
  momentos: "Momentos",
  complementos: "Complementos",
};

/**
 * Qué le falta a una selección para ser un paquete contratable, o `null`.
 *
 * Es la misma regla del wizard y del servidor, dicha con las palabras del
 * panel. Va acá además de en el servidor para que el botón de guardar avise
 * antes de intentar, en vez de fallar después.
 */
function queFalta(partes: Parte[], sel: Seleccion): string | null {
  const lineas = lineasDe(partes, sel);
  if (lineas.length === 0) return "Marcá al menos un ítem del catálogo.";

  const momentos = partes.find((p) => p.id === "momentos");
  if (!momentos?.items.some((i) => sel.items.includes(i.id))) {
    return "Un paquete necesita al menos un momento para cubrir.";
  }

  const faltan = sinCobertura(partes, sel);
  if (faltan[0]) {
    return `Falta con qué se cubre ${faltan[0].nombre.toLowerCase()}: foto o video.`;
  }

  const sinLugar = partes
    .flatMap((p) => p.items)
    .find(
      (i) =>
        sel.items.includes(i.id) &&
        i.locaciones?.length &&
        !sel.locaciones[i.id],
    );
  if (sinLugar) return `Falta dónde se hace ${sinLugar.nombre.toLowerCase()}.`;

  return null;
}

export function Paquetes() {
  const [evento, setEvento] = useState<Evento>("boda");
  /** `id` en `null` es uno nuevo. Por id y no por copia, igual que en el catálogo. */
  const [editando, setEditando] = useState<{ id: string | null } | null>(null);
  const [aBorrar, setABorrar] = useState<PaqueteAdmin | null>(null);

  const utils = api.useUtils();
  const lista = api.paquete.listar.useQuery({ evento });
  const catalogo = api.catalogo.listar.useQuery({ evento });
  const refrescar = () => utils.paquete.listar.invalidate();

  const partes = useMemo(() => partesDe(catalogo.data ?? []), [catalogo.data]);

  // Interruptor y flechas se pintan antes de que el servidor conteste, por lo
  // mismo que en el catálogo: son gestos de a varios clics seguidos.
  const activar = api.paquete.activar.useMutation({
    onMutate: async ({ id, activo }) => {
      await utils.paquete.listar.cancel({ evento });
      const previo = utils.paquete.listar.getData({ evento });
      utils.paquete.listar.setData({ evento }, (ps) =>
        ps?.map((p) => (p.id === id ? { ...p, activo } : p)),
      );
      return { previo };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previo) utils.paquete.listar.setData({ evento }, ctx.previo);
    },
    onSettled: refrescar,
  });

  const mover = api.paquete.mover.useMutation({
    onMutate: async ({ id, direccion }) => {
      await utils.paquete.listar.cancel({ evento });
      const previo = utils.paquete.listar.getData({ evento });
      utils.paquete.listar.setData({ evento }, (ps) => {
        if (!ps) return ps;
        const i = ps.findIndex((p) => p.id === id);
        const j = direccion === "sube" ? i - 1 : i + 1;
        if (i === -1 || j < 0 || j >= ps.length) return ps;
        const copia = [...ps];
        [copia[i], copia[j]] = [copia[j]!, copia[i]!];
        return copia;
      });
      return { previo };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previo) utils.paquete.listar.setData({ evento }, ctx.previo);
    },
    onSettled: refrescar,
  });

  const borrar = api.paquete.eliminar.useMutation({
    onSuccess: async () => {
      setABorrar(null);
      await refrescar();
    },
  });

  const enEdicion =
    (editando?.id && lista.data?.find((p) => p.id === editando.id)) || null;

  return (
    <>
      <div className="mb-6">
        <Link
          href="/admin/presupuestos"
          className="inline-flex items-center gap-2 font-rotulo text-[11.5px] tracking-[0.08em] text-gray-45 uppercase hover:text-ink"
        >
          <IconoVolver className="h-3 w-3" />
          Presupuestos
        </Link>
      </div>

      <Encabezado
        eyebrow="Simulador"
        titulo="Paquetes"
        bajada="Presupuestos prearmados con lo que ya está en el catálogo. Aparecen como primer paso del simulador, antes de armar a medida; el precio sale del catálogo en vivo, así que cambiarlo allá los actualiza."
      />

      <div className="mt-10 mb-6 flex flex-wrap gap-2">
        {EVENTOS_ORDEN.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEvento(e)}
            className={`cursor-pointer border px-4 py-2.5 font-rotulo text-[12px] tracking-[0.06em] uppercase transition-colors ${
              evento === e
                ? "border-ink bg-ink text-paper"
                : "border-gray-20 text-gray-70 hover:border-ink hover:text-ink"
            }`}
          >
            {EVENTOS[e].nombre}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <p className="nota max-w-[62ch]">
          Se ofrecen en este orden. Un paquete apagado no se muestra pero no se
          borra.
        </p>
        <Boton
          variante="fantasma"
          className="text-[11.5px]"
          onClick={() => setEditando({ id: null })}
          disabled={catalogo.isPending}
        >
          <IconoMas />
          Agregar
        </Boton>
      </div>

      {lista.isPending ? (
        <p className="nota">Cargando…</p>
      ) : (lista.data ?? []).length === 0 ? (
        <Vacio>
          Todavía no hay paquetes para {EVENTOS[evento].nombre.toLowerCase()}.
          Sin paquetes, el simulador arranca directo en el armado a medida.
        </Vacio>
      ) : (
        <div className="border border-ink">
          {(lista.data ?? []).map((p, i, todos) => (
            <Fila
              key={p.id}
              paquete={p}
              primero={i === 0}
              ultimo={i === todos.length - 1}
              alEditar={() => setEditando({ id: p.id })}
              alBorrar={() => setABorrar(p)}
              alActivar={(activo) => activar.mutate({ id: p.id, activo })}
              alMover={(direccion) => mover.mutate({ id: p.id, direccion })}
            />
          ))}
        </div>
      )}

      {editando && (
        <EditorPaquete
          key={editando.id ?? "nuevo"}
          evento={evento}
          partes={partes}
          paquete={enEdicion}
          alCerrar={() => setEditando(null)}
          alGuardar={refrescar}
        />
      )}

      <Modal
        abierto={aBorrar !== null}
        alCerrar={() => setABorrar(null)}
        eyebrow={aBorrar?.nombre}
        titulo="Borrar el paquete"
      >
        <p className="flex items-start gap-2.5 text-[14px] leading-relaxed text-gray-70">
          <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Deja de ofrecerse en el simulador. Los presupuestos ya emitidos no
            se tocan: guardan sus líneas con el precio adentro. Si es por una
            temporada, conviene apagarlo en vez de borrarlo.
          </span>
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Boton variante="fantasma" onClick={() => setABorrar(null)}>
            Cancelar
          </Boton>
          <Boton
            onClick={() => aBorrar && borrar.mutate({ id: aBorrar.id })}
            disabled={borrar.isPending}
          >
            <IconoPapelera />
            {borrar.isPending ? "Borrando…" : "Borrar"}
          </Boton>
        </div>
      </Modal>
    </>
  );
}

/* --------------------------------------------------------------------- fila */

function Fila({
  paquete,
  primero,
  ultimo,
  alEditar,
  alBorrar,
  alActivar,
  alMover,
}: {
  paquete: PaqueteAdmin;
  primero: boolean;
  ultimo: boolean;
  alEditar: () => void;
  alBorrar: () => void;
  alActivar: (activo: boolean) => void;
  alMover: (direccion: "sube" | "baja") => void;
}) {
  const cuantos = paquete.seleccion.items.length;
  const vacio = cuantos === 0;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-gray-20 px-4 py-3 last:border-b-0 ${
        paquete.activo ? "" : "bg-paper-dim"
      }`}
    >
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          onClick={() => alMover("sube")}
          disabled={primero}
          aria-label="Subir"
          className="cursor-pointer px-1 text-gray-45 hover:text-ink disabled:cursor-default disabled:opacity-25"
        >
          <IconoBajar className="h-3 w-3 rotate-180" />
        </button>
        <button
          type="button"
          onClick={() => alMover("baja")}
          disabled={ultimo}
          aria-label="Bajar"
          className="cursor-pointer px-1 text-gray-45 hover:text-ink disabled:cursor-default disabled:opacity-25"
        >
          <IconoBajar className="h-3 w-3" />
        </button>
      </div>

      <span className="grid h-12 w-12 shrink-0 place-items-center border border-ink">
        <IconoDePaquete icono={paquete.icono} className="h-5 w-5" />
      </span>

      <button
        type="button"
        onClick={alEditar}
        className="min-w-0 flex-1 cursor-pointer text-left"
      >
        <span
          className={`block text-[14px] ${paquete.activo ? "" : "line-through"}`}
        >
          {paquete.nombre}
        </span>
        {paquete.texto && (
          <span className="nota block truncate text-[12px]">
            {paquete.texto}
          </span>
        )}
        <span className="mt-0.5 block font-rotulo text-[10.5px] tracking-[0.06em] text-gray-45 uppercase">
          {vacio
            ? "Sin ítems vigentes: no se ofrece"
            : `${cuantos} ${cuantos === 1 ? "ítem" : "ítems"} del catálogo`}
        </span>
      </button>

      <span className="shrink-0 text-[14px] tabular-nums">
        {pesos(paquete.total)}
      </span>

      <div className="flex shrink-0 items-center gap-4">
        <label className="flex cursor-pointer items-center gap-1.5 font-rotulo text-[10.5px] tracking-[0.06em] text-gray-45 uppercase">
          <input
            type="checkbox"
            checked={paquete.activo}
            onChange={(e) => alActivar(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--color-ink)]"
          />
          Activo
        </label>
        <BotonTexto onClick={alBorrar} className="text-gray-45">
          <IconoPapelera />
        </BotonTexto>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- editor */

function EditorPaquete({
  evento,
  partes,
  paquete,
  alCerrar,
  alGuardar,
}: {
  evento: Evento;
  partes: Parte[];
  paquete: PaqueteAdmin | null;
  alCerrar: () => void;
  alGuardar: () => Promise<unknown>;
}) {
  const [nombre, setNombre] = useState(paquete?.nombre ?? "");
  const [texto, setTexto] = useState(paquete?.texto ?? "");
  const [icono, setIcono] = useState<IconoPaquete>(
    paquete?.icono ?? "estrella",
  );
  const [sel, setSel] = useState<Seleccion>(
    paquete?.seleccion ?? SELECCION_VACIA,
  );

  const lineas = useMemo(() => lineasDe(partes, sel), [partes, sel]);
  const total = totalDe(lineas);
  const falta = queFalta(partes, sel);
  const nombreListo = nombre.trim().length >= 2;

  const cerrar = async () => {
    await alGuardar();
    alCerrar();
  };
  const crear = api.paquete.crear.useMutation({ onSuccess: cerrar });
  const editar = api.paquete.editar.useMutation({ onSuccess: cerrar });
  const guardando = crear.isPending || editar.isPending;
  const error = crear.error ?? editar.error;

  function guardar() {
    const datos = {
      nombre: nombre.trim(),
      texto: texto.trim(),
      icono,
      seleccion: sel,
    };
    if (paquete) editar.mutate({ id: paquete.id, ...datos });
    else crear.mutate({ evento, ...datos });
  }

  /* --------------------------------------------- lo mismo que en el wizard */

  function alternarItem(id: string) {
    setSel((s) => {
      if (s.items.includes(id)) {
        // Al sacar el ítem se van sus coberturas y su locación: no tiene
        // sentido guardar decisiones sobre algo que ya no está.
        const { [id]: _c, ...coberturas } = s.coberturas;
        const { [id]: _l, ...locaciones } = s.locaciones;
        return {
          items: s.items.filter((x) => x !== id),
          coberturas,
          locaciones,
        };
      }
      return { ...s, items: [...s.items, id] };
    });
  }

  function alternarCobertura(itemId: string, cId: string) {
    setSel((s) => {
      const puestas = s.coberturas[itemId] ?? [];
      const nuevas = puestas.includes(cId)
        ? puestas.filter((x) => x !== cId)
        : [...puestas, cId];
      return { ...s, coberturas: { ...s.coberturas, [itemId]: nuevas } };
    });
  }

  function ponerLocacion(itemId: string, lId: string) {
    setSel((s) => ({ ...s, locaciones: { ...s.locaciones, [itemId]: lId } }));
  }

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      eyebrow={EVENTOS[evento].nombre}
      titulo={paquete ? "Editar el paquete" : "Nuevo paquete"}
      // Dos columnas: el armado a la izquierda y lo que va a ver la persona a
      // la derecha. En 560 no entran las dos.
      ancho="w-[min(980px,calc(100vw-2rem))]"
    >
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Campo
              label="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Cobertura completa"
              maxLength={60}
            />
          </div>

          <CampoTexto
            label="Texto corto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Para quién es y qué lo distingue. Opcional."
          />

          <div>
            <Etiqueta>Ícono</Etiqueta>
            <div
              className="mt-1.5 flex flex-wrap gap-1.5"
              role="radiogroup"
              aria-label="Ícono del paquete"
            >
              {ICONOS_PAQUETE.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  role="radio"
                  aria-checked={icono === ic}
                  aria-label={NOMBRE_ICONO[ic]}
                  title={NOMBRE_ICONO[ic]}
                  onClick={() => setIcono(ic)}
                  className={`grid h-10 w-10 cursor-pointer place-items-center border transition-colors ${
                    icono === ic
                      ? "border-ink bg-ink text-paper"
                      : "border-gray-20 text-gray-70 hover:border-ink hover:text-ink"
                  }`}
                >
                  <IconoDePaquete icono={ic} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {/* El catálogo, para marcar. Es la misma estructura que recorre el
              wizard, en forma de lista: acá no hace falta vender cada ítem con
              foto, hace falta ver todo de una y marcar rápido. */}
          {partes.map((parte) => (
            <div key={parte.id}>
              <Etiqueta>{parte.titulo}</Etiqueta>
              {parte.items.length === 0 ? (
                <p className="nota mt-1.5">
                  No hay ítems activos en esta parte.
                </p>
              ) : (
                <div className="mt-1.5 border border-gray-20">
                  {parte.items.map((item) => {
                    const puesto = sel.items.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        className="border-b border-gray-20 last:border-b-0"
                      >
                        <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={puesto}
                            onChange={() => alternarItem(item.id)}
                            className="mt-1 h-3.5 w-3.5 accent-[var(--color-ink)]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14px]">
                              {item.nombre}
                            </span>
                            <span className="nota block truncate text-[12px]">
                              {item.texto}
                            </span>
                          </span>
                          {!item.coberturas && (
                            <span className="shrink-0 text-[13px] tabular-nums text-gray-45">
                              {pesos(item.precio)}
                            </span>
                          )}
                        </label>

                        {puesto && item.coberturas && (
                          <div className="border-t border-dashed border-gray-20 bg-paper-dim px-3 py-2.5 pl-10">
                            <p className="mb-1.5 font-rotulo text-[10.5px] tracking-[0.08em] text-gray-45 uppercase">
                              Con qué se cubre
                            </p>
                            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                              {item.coberturas.map((c) => (
                                <label
                                  key={c.id}
                                  className="flex cursor-pointer items-center gap-2 text-[13px]"
                                >
                                  <input
                                    type="checkbox"
                                    checked={(
                                      sel.coberturas[item.id] ?? []
                                    ).includes(c.id)}
                                    onChange={() =>
                                      alternarCobertura(item.id, c.id)
                                    }
                                    className="h-3.5 w-3.5 accent-[var(--color-ink)]"
                                  />
                                  {c.nombre}
                                  <span className="tabular-nums text-gray-45">
                                    + {pesos(c.extra)}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {puesto && item.locaciones && (
                          <div className="border-t border-dashed border-gray-20 bg-paper-dim px-3 py-2.5 pl-10">
                            <p className="mb-1.5 font-rotulo text-[10.5px] tracking-[0.08em] text-gray-45 uppercase">
                              Dónde se hace
                            </p>
                            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                              {item.locaciones.map((l) => (
                                <label
                                  key={l.id}
                                  className="flex cursor-pointer items-center gap-2 text-[13px]"
                                >
                                  <input
                                    type="radio"
                                    name={`loc-${item.id}`}
                                    checked={sel.locaciones[item.id] === l.id}
                                    onChange={() =>
                                      ponerLocacion(item.id, l.id)
                                    }
                                    className="h-3.5 w-3.5 accent-[var(--color-ink)]"
                                  />
                                  {l.nombre}
                                  {l.extra > 0 && (
                                    <span className="tabular-nums text-gray-45">
                                      + {pesos(l.extra)}
                                    </span>
                                  )}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Lo que va a ver la persona: la tarjeta tal cual. */}
        <div className="lg:sticky lg:top-0 lg:self-start">
          <Etiqueta>Así se ofrece</Etiqueta>
          <div className="mt-1.5 border border-ink">
            <div className="flex items-start gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center border border-ink">
                <IconoDePaquete icono={icono} className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-titulo text-[1.3rem] leading-tight uppercase">
                  {nombre.trim() || "Nombre del paquete"}
                </div>
                {texto.trim() && (
                  <p className="mt-1 text-[13px] leading-relaxed text-gray-70">
                    {texto}
                  </p>
                )}
              </div>
            </div>
            <div className="border-t border-gray-20 px-4 pt-3 pb-4">
              <Detalle lineas={lineas} total={total} />
            </div>
          </div>

          {falta ? (
            <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-relaxed text-gray-70">
              <IconoAlerta className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {falta}
            </p>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-[12.5px] text-gray-45">
              <IconoTilde className="h-3.5 w-3.5" />
              Se puede contratar tal cual.
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
        {error && (
          <span className="nota mr-auto text-[12px] text-marca">
            {error.message}
          </span>
        )}
        <Boton variante="fantasma" onClick={alCerrar}>
          Cancelar
        </Boton>
        <Boton
          onClick={guardar}
          disabled={!nombreListo || falta !== null || guardando}
        >
          {guardando ? "Guardando…" : paquete ? "Guardar" : "Crear paquete"}
        </Boton>
      </div>
    </Modal>
  );
}
