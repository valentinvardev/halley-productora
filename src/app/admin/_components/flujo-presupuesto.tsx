"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  IconoAlerta,
  IconoBajar,
  IconoMas,
  IconoPapelera,
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
import { EVENTOS, EVENTOS_ORDEN, type Evento } from "~/app/_datos/presupuesto";
import { pesos } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

import { BotonImagen, ElegirImagen } from "./elegir-imagen";

/**
 * El flujo del presupuesto: qué se ofrece, cómo se cuenta y cuánto sale.
 *
 * Es el otro lado del simulador. Todo lo que alguien ve al armar su presupuesto
 * —los ítems, sus textos, sus precios, sus fotos— se edita acá, y la razón es
 * simple: nada de eso es código. Un precio cambia por temporada y un texto se
 * reescribe cuando aparece una forma mejor de decirlo; si cada cambio pide un
 * deploy, se dejan de hacer.
 *
 * Lo que no se toca desde acá es la estructura: que haya tres partes, que la
 * primera admita combinar, que el pago tenga cuatro planes. Eso no es un dato
 * del negocio, es el diseño del wizard.
 *
 * Los dos eventos se editan por separado incluso donde la lista es la misma.
 * Una cobertura de fotografía para una boda y para un quince son el mismo
 * trabajo con distinta cantidad de horas: compartir la fila obligaría a
 * compartir el precio.
 */

const ROTULO_PARTE = {
  momentos: {
    titulo: "Parte 1 · Momentos",
    ayuda: "Qué partes del día se cubren. Se pueden combinar.",
  },
  coberturas: {
    titulo: "Parte 2 · Coberturas",
    ayuda: "Con qué se cubre: fotografía, video, redes.",
  },
  complementos: {
    titulo: "Parte 3 · Complementos",
    ayuda: "Lo que se agrega sobre la cobertura. Nada es obligatorio.",
  },
} as const;

type Grupo = RouterOutputs["catalogo"]["listar"][number];
type Item = Grupo["items"][number];
type Locacion = Item["locaciones"][number];

export function FlujoPresupuesto() {
  const [evento, setEvento] = useState<Evento>("boda");
  /**
   * Qué se está editando, por id y no por copia.
   *
   * Guardar el ítem entero acá lo congelaba en el estado que tenía al abrir el
   * modal: agregarle una locación o ponerle una foto refrescaba la lista de
   * atrás pero no lo que el modal estaba mostrando, y había que cerrarlo y
   * volver a abrirlo para ver el cambio. Con el id, lo que se pinta sale
   * siempre de la consulta.
   *
   * `id` en `null` es un ítem nuevo, que todavía no tiene de dónde salir.
   */
  const [editando, setEditando] = useState<
    { id: string | null; parte: Grupo["parte"] } | null
  >(null);
  const [aBorrar, setABorrar] = useState<Item | null>(null);

  const utils = api.useUtils();
  const lista = api.catalogo.listar.useQuery({ evento });
  const refrescar = () => utils.catalogo.listar.invalidate();

  const activar = api.catalogo.activarItem.useMutation({
    // Optimista: es un interruptor, y esperar al servidor para pintarlo deja la
    // fila quieta el tiempo justo para que uno lo vuelva a apretar.
    onMutate: async ({ id, activo }) => {
      await utils.catalogo.listar.cancel({ evento });
      const previo = utils.catalogo.listar.getData({ evento });
      utils.catalogo.listar.setData({ evento }, (gs) =>
        gs?.map((g) => ({
          ...g,
          items: g.items.map((i) => (i.id === id ? { ...i, activo } : i)),
        })),
      );
      return { previo };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previo) utils.catalogo.listar.setData({ evento }, ctx.previo);
    },
    onSettled: refrescar,
  });

  /**
   * Subir y bajar también se pinta antes de que el servidor conteste.
   *
   * El movimiento es el que uno acaba de pedir con la flecha: no hay nada que
   * el servidor pueda decir que cambie el resultado, sólo puede confirmarlo. Y
   * reordenar es de las cosas que se hacen de a varios clics seguidos —subir
   * tres lugares son tres— así que esperar la respuesta entre uno y otro es
   * exactamente donde más se siente.
   *
   * La lista ya viene ordenada, así que el intercambio en la caché es el mismo
   * que hace el servidor con los `orden`: cambiar de lugar al ítem con su
   * vecino dentro de su parte.
   */
  const mover = api.catalogo.moverItem.useMutation({
    onMutate: async ({ id, direccion }) => {
      await utils.catalogo.listar.cancel({ evento });
      const previo = utils.catalogo.listar.getData({ evento });

      utils.catalogo.listar.setData({ evento }, (gs) =>
        gs?.map((g) => {
          const i = g.items.findIndex((it) => it.id === id);
          if (i === -1) return g;

          const j = direccion === "sube" ? i - 1 : i + 1;
          if (j < 0 || j >= g.items.length) return g;

          const items = [...g.items];
          [items[i], items[j]] = [items[j]!, items[i]!];
          return { ...g, items };
        }),
      );
      return { previo };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previo) utils.catalogo.listar.setData({ evento }, ctx.previo);
    },
    onSettled: refrescar,
  });
  const borrar = api.catalogo.eliminarItem.useMutation({
    onSuccess: async () => {
      setABorrar(null);
      await refrescar();
    },
  });

  /** El ítem que el modal está mostrando, tal como está ahora en la lista. */
  const enEdicion =
    (editando?.id &&
      lista.data
        ?.flatMap((g) => g.items)
        .find((i) => i.id === editando.id)) ||
    null;

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
        titulo="Flujo del presupuesto"
        bajada="Lo que se ofrece en el simulador de la web: los ítems de cada paso, sus textos, sus precios y sus fotos. Se guarda al instante y sale sin esperar un deploy."
      />

      <Parametros />

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

      {lista.isPending ? (
        <p className="nota">Cargando…</p>
      ) : (
        (lista.data ?? []).map((g) => (
          <section key={g.parte} className="mb-10">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-rotulo text-[13px] tracking-[0.08em] uppercase">
                  {ROTULO_PARTE[g.parte].titulo}
                </h3>
                <p className="nota mt-1">{ROTULO_PARTE[g.parte].ayuda}</p>
              </div>
              <Boton
                variante="fantasma"
                className="text-[11.5px]"
                onClick={() => setEditando({ id: null, parte: g.parte })}
              >
                <IconoMas />
                Agregar
              </Boton>
            </div>

            {g.items.length === 0 ? (
              <Vacio>No hay nada cargado en esta parte.</Vacio>
            ) : (
              <div className="border border-ink">
                {g.items.map((item, i) => (
                  <Fila
                    key={item.id}
                    item={item}
                    primero={i === 0}
                    ultimo={i === g.items.length - 1}
                    alEditar={() => setEditando({ id: item.id, parte: g.parte })}
                    alBorrar={() => setABorrar(item)}
                    alActivar={(activo) =>
                      activar.mutate({ id: item.id, activo })
                    }
                    alMover={(direccion) =>
                      mover.mutate({ id: item.id, direccion })
                    }
                  />
                ))}
              </div>
            )}
          </section>
        ))
      )}

      {editando && (
        <EditorItem
          // El `key` es lo que hace que el formulario se rellene al abrir otro
          // ítem: sin él, React reusa el componente y los campos se quedan con
          // lo que tenía el anterior.
          key={editando.id ?? "nuevo"}
          evento={evento}
          parte={editando.parte}
          item={enEdicion}
          alCerrar={() => setEditando(null)}
          alGuardar={refrescar}
        />
      )}

      <Modal
        abierto={aBorrar !== null}
        alCerrar={() => setABorrar(null)}
        eyebrow={aBorrar?.nombre}
        titulo="Borrar del catálogo"
      >
        <p className="flex items-start gap-2.5 text-[14px] leading-relaxed text-gray-70">
          <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Los presupuestos ya emitidos no se tocan: guardan sus líneas con el
            precio adentro y siguen diciendo lo que decían. Lo que se pierde es
            que alguien pueda volver a elegirlo. Si es por una temporada,
            conviene apagarlo en vez de borrarlo.
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
  item,
  primero,
  ultimo,
  alEditar,
  alBorrar,
  alActivar,
  alMover,
}: {
  item: Item;
  primero: boolean;
  ultimo: boolean;
  alEditar: () => void;
  alBorrar: () => void;
  alActivar: (activo: boolean) => void;
  alMover: (direccion: "sube" | "baja") => void;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-gray-20 px-4 py-3 last:border-b-0 ${
        item.activo ? "" : "bg-paper-dim"
      }`}
    >
      {/* El orden se cambia acá y no arrastrando: son listas de cinco ítems que
          se tocan una vez por temporada, y dos flechas funcionan igual en un
          teléfono, donde arrastrar pelea con el scroll. */}
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

      {item.imagen ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imagen}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-12 w-12 shrink-0 border border-gray-20 object-cover"
        />
      ) : (
        <span className="h-12 w-12 shrink-0 border border-dashed border-gray-20" />
      )}

      <button
        type="button"
        onClick={alEditar}
        className="min-w-0 flex-1 cursor-pointer text-left"
      >
        <span className={`block text-[14px] ${item.activo ? "" : "line-through"}`}>
          {item.nombre}
        </span>
        <span className="nota block truncate text-[12px]">{item.texto}</span>
        {item.locaciones.length > 0 && (
          <span className="mt-0.5 block font-rotulo text-[10.5px] tracking-[0.06em] text-gray-45 uppercase">
            {item.locaciones.length} locaciones
          </span>
        )}
      </button>

      <span className="shrink-0 text-[14px] tabular-nums">
        {pesos(item.precio)}
      </span>

      <div className="flex shrink-0 items-center gap-4">
        <label className="flex cursor-pointer items-center gap-1.5 font-rotulo text-[10.5px] tracking-[0.06em] text-gray-45 uppercase">
          <input
            type="checkbox"
            checked={item.activo}
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

function EditorItem({
  evento,
  parte,
  item,
  alCerrar,
  alGuardar,
}: {
  evento: Evento;
  parte: Grupo["parte"];
  item: Item | null;
  alCerrar: () => void;
  alGuardar: () => Promise<unknown>;
}) {
  const [nombre, setNombre] = useState(item?.nombre ?? "");
  const [texto, setTexto] = useState(item?.texto ?? "");
  const [precio, setPrecio] = useState(String(item?.precio ?? ""));
  const [imagenId, setImagenId] = useState<string | null>(
    item?.imagenId ?? null,
  );
  const [imagen, setImagen] = useState<string | undefined>(item?.imagen);
  const [eligiendo, setEligiendo] = useState(false);

  const utils = api.useUtils();
  const imagenes = api.catalogo.imagenes.useQuery(undefined, {
    enabled: eligiendo,
  });

  // La miniatura del botón sale de la lista ya cargada: sin esto, al elegir una
  // imagen el botón se quedaba en blanco hasta cerrar y volver a abrir.
  useEffect(() => {
    if (!imagenId) return setImagen(undefined);
    const encontrada = imagenes.data?.find((i) => i.id === imagenId);
    if (encontrada) setImagen(encontrada.url);
  }, [imagenId, imagenes.data]);

  const cerrar = async () => {
    await alGuardar();
    alCerrar();
  };

  const crear = api.catalogo.crearItem.useMutation({ onSuccess: cerrar });
  const editar = api.catalogo.editarItem.useMutation({ onSuccess: cerrar });

  const guardando = crear.isPending || editar.isPending;
  const error = crear.error ?? editar.error;
  const monto = Math.max(0, Math.round(Number(precio.replace(/\D/g, "")) || 0));
  const listo = nombre.trim().length >= 2 && texto.trim().length >= 3;

  function guardar() {
    const datos = { nombre: nombre.trim(), texto: texto.trim(), precio: monto, imagenId };
    if (item) editar.mutate({ id: item.id, ...datos });
    else crear.mutate({ evento, parte, ...datos });
  }

  return (
    <>
      <Modal
        abierto
        alCerrar={alCerrar}
        eyebrow={ROTULO_PARTE[parte].titulo}
        titulo={item ? "Editar el ítem" : "Nuevo ítem"}
      >
        <div className="grid gap-5">
          <div className="flex items-start gap-4">
            <BotonImagen
              imagen={imagen}
              onClick={() => setEligiendo(true)}
              className="mt-6"
            />
            <div className="min-w-0 flex-1">
              <Campo
                label="Nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Cobertura de la fiesta"
              />
            </div>
          </div>

          <CampoTexto
            label="Descripción"
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            hint="La que se lee debajo del nombre en la tarjeta."
            placeholder="La entrada, el vals, el brindis y el baile, de punta a punta."
          />

          <Campo
            label="Precio"
            value={precio}
            inputMode="numeric"
            onChange={(e) => setPrecio(e.target.value)}
            hint={monto > 0 ? pesos(monto) : "Sólo números."}
            placeholder="980000"
          />

          {item && (
            <div>
              <Etiqueta>Clave</Etiqueta>
              <p className="mt-1 font-mono text-[12px] text-gray-45">
                {item.clave}
              </p>
              <p className="nota mt-1 text-[11.5px]">
                Con esto viaja el ítem en los presupuestos ya emitidos, así que
                no cambia aunque le cambies el nombre.
              </p>
            </div>
          )}
        </div>

        {item && <Locaciones item={item} alGuardar={alGuardar} />}

        {error && (
          <p className="mt-4 flex items-start gap-2 border border-marca px-3 py-2 text-[13px] text-marca">
            <IconoAlerta className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error.message}
          </p>
        )}

        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <Boton variante="fantasma" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={guardar} disabled={!listo || guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </Boton>
        </div>
      </Modal>

      <ElegirImagen
        abierto={eligiendo}
        alCerrar={() => setEligiendo(false)}
        valor={imagenId}
        alElegir={(id) => {
          setImagenId(id);
          void utils.catalogo.imagenes.invalidate();
        }}
      />
    </>
  );
}

/* --------------------------------------------------------------- locaciones */

/**
 * Las variantes que cambian el precio de un ítem: dónde se hace el book.
 *
 * Se editan adentro del ítem y no en una pantalla propia porque no existen sin
 * él: una locación suelta no significa nada. Y sólo aparecen en un ítem ya
 * creado, porque hasta que no lo esté no hay de qué colgarlas.
 */
function Locaciones({
  item,
  alGuardar,
}: {
  item: Item;
  alGuardar: () => Promise<unknown>;
}) {
  const [abriendo, setAbriendo] = useState<Locacion | null | "nueva">(null);

  const borrar = api.catalogo.eliminarLocacion.useMutation({
    onSuccess: () => alGuardar(),
  });

  return (
    <div className="mt-7 border-t border-gray-20 pt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Etiqueta>Locaciones</Etiqueta>
          <p className="nota mt-1 text-[11.5px]">
            Variantes que suman sobre el precio. Aparecen dentro de la tarjeta
            cuando alguien la elige.
          </p>
        </div>
        <BotonTexto onClick={() => setAbriendo("nueva")}>
          <IconoMas />
          Agregar
        </BotonTexto>
      </div>

      {item.locaciones.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-20 border border-gray-20">
          {item.locaciones.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-3 py-2">
              {l.imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={l.imagen}
                  alt=""
                  loading="lazy"
                  className="h-8 w-8 shrink-0 border border-gray-20 object-cover"
                />
              ) : (
                <span className="h-8 w-8 shrink-0 border border-dashed border-gray-20" />
              )}
              <button
                type="button"
                onClick={() => setAbriendo(l)}
                className="min-w-0 flex-1 cursor-pointer text-left text-[13.5px]"
              >
                {l.nombre}
              </button>
              <span className="text-[13px] tabular-nums text-gray-45">
                {l.extra === 0 ? "Sin cargo" : `+ ${pesos(l.extra)}`}
              </span>
              <BotonTexto
                onClick={() => borrar.mutate({ id: l.id })}
                className="text-gray-45"
              >
                <IconoPapelera />
              </BotonTexto>
            </li>
          ))}
        </ul>
      )}

      {abriendo && (
        <EditorLocacion
          itemId={item.id}
          locacion={abriendo === "nueva" ? null : abriendo}
          alCerrar={() => setAbriendo(null)}
          alGuardar={alGuardar}
        />
      )}
    </div>
  );
}

function EditorLocacion({
  itemId,
  locacion,
  alCerrar,
  alGuardar,
}: {
  itemId: string;
  locacion: Locacion | null;
  alCerrar: () => void;
  alGuardar: () => Promise<unknown>;
}) {
  const [nombre, setNombre] = useState(locacion?.nombre ?? "");
  const [texto, setTexto] = useState(locacion?.texto ?? "");
  const [extra, setExtra] = useState(String(locacion?.extra ?? "0"));
  const [imagenId, setImagenId] = useState<string | null>(
    locacion?.imagenId ?? null,
  );
  const [imagen, setImagen] = useState<string | undefined>(locacion?.imagen);
  const [eligiendo, setEligiendo] = useState(false);

  const imagenes = api.catalogo.imagenes.useQuery(undefined, {
    enabled: eligiendo,
  });

  useEffect(() => {
    if (!imagenId) return setImagen(undefined);
    const encontrada = imagenes.data?.find((i) => i.id === imagenId);
    if (encontrada) setImagen(encontrada.url);
  }, [imagenId, imagenes.data]);

  const guardar = api.catalogo.guardarLocacion.useMutation({
    onSuccess: async () => {
      await alGuardar();
      alCerrar();
    },
  });

  const monto = Math.max(0, Math.round(Number(extra.replace(/\D/g, "")) || 0));
  const listo = nombre.trim().length >= 2 && texto.trim().length >= 3;

  return (
    <>
      <Modal
        abierto
        alCerrar={alCerrar}
        eyebrow="Locación"
        titulo={locacion ? "Editar la locación" : "Nueva locación"}
      >
        <div className="grid gap-5">
          <div className="flex items-start gap-4">
            <BotonImagen
              imagen={imagen}
              onClick={() => setEligiendo(true)}
              className="mt-6"
            />
            <div className="min-w-0 flex-1">
              <Campo
                label="Nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Sierras o altas cumbres"
              />
            </div>
          </div>

          <CampoTexto
            label="Descripción"
            rows={2}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Una jornada afuera, con traslado y luz de atardecer."
          />

          <Campo
            label="Cuánto suma"
            value={extra}
            inputMode="numeric"
            onChange={(e) => setExtra(e.target.value)}
            hint={
              monto > 0
                ? `+ ${pesos(monto)} sobre el precio del ítem`
                : "Sin cargo."
            }
          />
        </div>

        {guardar.error && (
          <p className="mt-4 border border-marca px-3 py-2 text-[13px] text-marca">
            {guardar.error.message}
          </p>
        )}

        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <Boton variante="fantasma" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            disabled={!listo || guardar.isPending}
            onClick={() =>
              guardar.mutate({
                id: locacion?.id,
                itemId,
                nombre: nombre.trim(),
                texto: texto.trim(),
                extra: monto,
                imagenId,
              })
            }
          >
            {guardar.isPending ? "Guardando…" : "Guardar"}
          </Boton>
        </div>
      </Modal>

      <ElegirImagen
        abierto={eligiendo}
        alCerrar={() => setEligiendo(false)}
        valor={imagenId}
        alElegir={setImagenId}
      />
    </>
  );
}

/* --------------------------------------------------------------- parámetros */

/**
 * Las perillas que no son ítems: la reserva, la Halley Box y el aviso de
 * precios provisorios.
 *
 * Van arriba y en una sola caja porque son cuatro números que se tocan juntos
 * al abrir la temporada y después no se miran más.
 */
function Parametros() {
  const guardados = api.catalogo.parametros.useQuery();
  const utils = api.useUtils();

  const [porcentaje, setPorcentaje] = useState("");
  const [minimo, setMinimo] = useState("");
  const [umbral, setUmbral] = useState("");
  const [confirmados, setConfirmados] = useState(false);
  const [tocado, setTocado] = useState(false);

  useEffect(() => {
    if (!guardados.data || tocado) return;
    setPorcentaje(String(Math.round(guardados.data.reservaPorcentaje * 100)));
    setMinimo(String(guardados.data.reservaMinimo));
    setUmbral(String(guardados.data.boxUmbral));
    setConfirmados(guardados.data.preciosConfirmados);
  }, [guardados.data, tocado]);

  const guardar = api.catalogo.guardarParametros.useMutation({
    onSuccess: async () => {
      setTocado(false);
      await utils.catalogo.parametros.invalidate();
    },
  });

  const numero = (v: string) => Math.max(0, Number(v.replace(/\D/g, "")) || 0);

  return (
    <div className="border border-ink p-5 sm:p-6">
      <Etiqueta>Reglas del presupuesto</Etiqueta>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Campo
          label="Reserva (%)"
          value={porcentaje}
          inputMode="numeric"
          onChange={(e) => {
            setTocado(true);
            setPorcentaje(e.target.value);
          }}
          hint="Del total. Se descuenta, no se suma."
        />
        <Campo
          label="Reserva mínima"
          value={minimo}
          inputMode="numeric"
          onChange={(e) => {
            setTocado(true);
            setMinimo(e.target.value);
          }}
          hint={numero(minimo) > 0 ? pesos(numero(minimo)) : "Sin piso."}
        />
        <Campo
          label="Halley Box desde"
          value={umbral}
          inputMode="numeric"
          onChange={(e) => {
            setTocado(true);
            setUmbral(e.target.value);
          }}
          hint={numero(umbral) > 0 ? pesos(numero(umbral)) : "Siempre incluida."}
        />
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={confirmados}
          onChange={(e) => {
            setTocado(true);
            setConfirmados(e.target.checked);
          }}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-ink)]"
        />
        <span className="text-[14px] leading-relaxed">
          Los precios son los definitivos.
          <span className="nota mt-0.5 block text-[12.5px]">
            Mientras esté sin tildar, el simulador aclara en pantalla que los
            valores son de referencia. Un presupuesto que sale con números
            provisorios sin avisar es una promesa que después hay que romper.
          </span>
        </span>
      </label>

      <div className="mt-5 flex items-center gap-4">
        <Boton
          disabled={!tocado || guardar.isPending}
          onClick={() =>
            guardar.mutate({
              // Entra como 20 y se guarda como 0,2: en pantalla se piensa en
              // por ciento y en la cuenta se multiplica.
              reservaPorcentaje: Math.min(100, numero(porcentaje)) / 100,
              reservaMinimo: numero(minimo),
              boxUmbral: numero(umbral),
              preciosConfirmados: confirmados,
            })
          }
        >
          {guardar.isPending ? "Guardando…" : "Guardar reglas"}
        </Boton>
        {guardar.isSuccess && !tocado && (
          <span className="nota text-[12px]">Guardado.</span>
        )}
      </div>
    </div>
  );
}
