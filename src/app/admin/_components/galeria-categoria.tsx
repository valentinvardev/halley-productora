"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  IconoBajar,
  IconoEstrella,
  IconoPapelera,
  IconoPuntos,
  IconoVolver,
} from "~/app/_components/iconos";
import { Modal } from "~/app/_components/modal";
import { MAX_PORTADAS } from "~/app/_components/portadas-rotativas";
import { Boton, Vacio } from "~/app/_components/ui";
import { api } from "~/trpc/react";
import { EsqueletoGaleria } from "./esqueletos";
import { Lightbox } from "~/app/_components/lightbox";
import { BotonesSubida } from "./botones-subida";
import { SubidaPopover } from "./subida-popover";
import { useCargaContenido } from "./usar-carga";
import { ZonaArrastre } from "./zona-arrastre";

type Rect = { left: number; top: number; right: number; bottom: number };

/**
 * La galería de una categoría: todas sus piezas, con selección múltiple y
 * borrado en tanda.
 *
 * Se selecciona de tres formas —el tilde de cada pieza, shift para un rango, y
 * arrastrando el mouse por encima para encerrar varias— porque manejar
 * cincuenta fotos de a una es inviable. El clic sin arrastre abre el visor; por
 * eso el arrastre marca un flag que ese clic mira antes de abrir nada.
 */
export function GaleriaCategoria({
  slug,
  nombre,
}: {
  slug: string;
  nombre: string;
}) {
  const utils = api.useUtils();
  const { data: piezas, isLoading } = api.contenido.listar.useQuery({
    categoria: slug,
  });

  const gridRef = useRef<HTMLDivElement>(null);

  const { cola, activo, subir, limpiar } = useCargaContenido(slug, () =>
    utils.contenido.listar.invalidate({ categoria: slug }),
  );

  const [sel, setSel] = useState<Set<string>>(new Set());
  const [marq, setMarq] = useState<Rect | null>(null);
  const [visor, setVisor] = useState<number | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  const huboDrag = useRef(false);
  const ancla = useRef<string | null>(null);

  const eliminar = api.contenido.eliminarVarios.useMutation({
    onSuccess: async () => {
      setSel(new Set());
      setConfirmar(false);
      await utils.contenido.listar.invalidate({ categoria: slug });
    },
  });

  const marcarPortada = api.contenido.marcarPortada.useMutation({
    onSuccess: () => utils.contenido.listar.invalidate({ categoria: slug }),
  });

  const moverPieza = api.contenido.moverContenido.useMutation({
    onSuccess: () => utils.contenido.listar.invalidate({ categoria: slug }),
  });

  /**
   * Arrastrar en escritorio, flechas en el teléfono.
   *
   * No es por tamaño de pantalla sino por si hay con qué apuntar. Con el dedo,
   * arrastrar tapa justo lo que se está moviendo y compite con el scroll; las
   * flechas de a un lugar ahí son mejores. Con cursor, arrastrar es lo que uno
   * espera de una grilla de fotos.
   */
  const [tactil, setTactil] = useState(false);
  useEffect(() => {
    setTactil(window.matchMedia("(hover: none)").matches);
  }, []);

  /**
   * El arrastre para reordenar.
   *
   * `id` es la pieza que se está llevando y `sobre` el lugar donde caería si
   * se soltara ahora, para pintarlo. Va por eventos de puntero y no por el
   * drag and drop nativo del navegador a propósito: el nativo ya lo usa la zona
   * de subida para recibir archivos, y los dos se pisarían.
   *
   * La lista se acomoda en el cliente apenas se suelta, antes de que el
   * servidor conteste. Esperar la respuesta para ver la foto en su lugar nuevo
   * es lo que hace que un arrastre se sienta como si no hubiera entrado.
   */
  const [arrastre, setArrastre] = useState<{
    id: string;
    sobre: number | null;
  } | null>(null);

  const reordenar = api.contenido.reordenar.useMutation({
    onMutate: async ({ ids }) => {
      await utils.contenido.listar.cancel({ categoria: slug });
      const previo = utils.contenido.listar.getData({ categoria: slug });
      if (previo) {
        const porId = new Map(previo.map((p) => [p.id, p]));
        utils.contenido.listar.setData(
          { categoria: slug },
          ids.map((id) => porId.get(id)!).filter(Boolean),
        );
      }
      return { previo };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previo) {
        utils.contenido.listar.setData({ categoria: slug }, ctx.previo);
      }
    },
    onSettled: () => utils.contenido.listar.invalidate({ categoria: slug }),
  });

  /** Dónde caería el puntero: el índice de la pieza que tiene debajo. */
  function indiceBajo(x: number, y: number) {
    const el = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-id]");
    if (!el?.dataset.id || !piezas) return null;
    const i = piezas.findIndex((p) => p.id === el.dataset.id);
    return i === -1 ? null : i;
  }

  function empezarArrastre(e: React.PointerEvent, id: string) {
    if (e.button !== 0 || !piezas) return;
    e.preventDefault();
    e.stopPropagation();
    const tirador = e.currentTarget as HTMLElement;
    tirador.setPointerCapture(e.pointerId);
    // Que el clic que cierra el arrastre no abra el visor.
    huboDrag.current = true;
    setArrastre({ id, sobre: null });

    const mover = (ev: PointerEvent) => {
      setArrastre({ id, sobre: indiceBajo(ev.clientX, ev.clientY) });
    };
    const soltar = (ev: PointerEvent) => {
      tirador.removeEventListener("pointermove", mover);
      tirador.removeEventListener("pointerup", soltar);
      tirador.removeEventListener("pointercancel", soltar);
      setArrastre(null);
      setTimeout(() => {
        huboDrag.current = false;
      }, 0);

      const hasta = indiceBajo(ev.clientX, ev.clientY);
      const desde = piezas.findIndex((p) => p.id === id);
      if (hasta === null || desde === -1 || hasta === desde) return;

      const ids = piezas.map((p) => p.id);
      ids.splice(desde, 1);
      ids.splice(hasta, 0, id);
      reordenar.mutate({ categoria: slug, ids });
    };
    tirador.addEventListener("pointermove", mover);
    tirador.addEventListener("pointerup", soltar);
    tirador.addEventListener("pointercancel", soltar);
  }

  function alternar(id: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    ancla.current = id;
  }

  function rango(hasta: string) {
    if (!piezas) return;
    const ids = piezas.map((p) => p.id);
    const a = ancla.current ? ids.indexOf(ancla.current) : ids.indexOf(hasta);
    const b = ids.indexOf(hasta);
    const [desde, hastaI] = a < b ? [a, b] : [b, a];
    setSel((s) => {
      const n = new Set(s);
      for (let i = desde; i <= hastaI; i++) n.add(ids[i]!);
      return n;
    });
  }

  /** Arrastre: encierra piezas dibujando un rectángulo sobre la grilla. */
  function alBajarEnGrilla(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // El tilde y los botones manejan su propio clic.
    if (target.closest("[data-no-marquee]")) return;

    const x0 = e.clientX;
    const y0 = e.clientY;
    const base = e.ctrlKey || e.metaKey ? new Set(sel) : new Set<string>();
    let arrastro = false;

    const mover = (ev: MouseEvent) => {
      if (!arrastro && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
      arrastro = true;
      huboDrag.current = true;

      const r: Rect = {
        left: Math.min(x0, ev.clientX),
        top: Math.min(y0, ev.clientY),
        right: Math.max(x0, ev.clientX),
        bottom: Math.max(y0, ev.clientY),
      };
      setMarq(r);

      const nuevos = new Set(base);
      gridRef.current
        ?.querySelectorAll<HTMLElement>("[data-id]")
        .forEach((el) => {
          const b = el.getBoundingClientRect();
          const fuera =
            b.right < r.left ||
            b.left > r.right ||
            b.bottom < r.top ||
            b.top > r.bottom;
          if (!fuera && el.dataset.id) nuevos.add(el.dataset.id);
        });
      setSel(nuevos);
      ev.preventDefault();
    };

    const soltar = () => {
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
      setMarq(null);
      // Se limpia después de que corran los onClick de las piezas, para que el
      // clic que cierra el arrastre no abra el visor.
      setTimeout(() => {
        huboDrag.current = false;
      }, 0);
    };

    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
  }

  function alClickPieza(e: React.MouseEvent, id: string, i: number) {
    if (huboDrag.current) return;
    if (e.shiftKey) {
      rango(id);
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      alternar(id);
      return;
    }
    setVisor(i);
  }

  // El rectángulo del arrastre, dibujado dentro de la grilla.
  const overlay = (() => {
    if (!marq || !gridRef.current) return null;
    const g = gridRef.current.getBoundingClientRect();
    return {
      left: marq.left - g.left,
      top: marq.top - g.top,
      width: marq.right - marq.left,
      height: marq.bottom - marq.top,
    };
  })();

  return (
    <>
      <Link
        href="/admin/contenidos"
        className="mb-6 inline-flex items-center gap-2 font-rotulo text-[12px] uppercase tracking-[0.14em] text-gray-45 hover:text-ink"
      >
        <IconoVolver className="h-3 w-3" />
        Contenidos
      </Link>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">Vitrina</div>
          <h1 className="font-titulo text-[34px] uppercase leading-none">
            {nombre}
          </h1>
          <p className="nota mt-2">
            {piezas?.length ?? 0} {piezas?.length === 1 ? "pieza" : "piezas"} ·
            arrastrá el mouse o usá el tilde para seleccionar · agarrá el
            tirador de abajo de cada foto para cambiarla de lugar · la landing
            arma una grilla al azar con todas, y las primeras {MAX_PORTADAS}{" "}
            abren la página de este servicio
          </p>
        </div>

        <BotonesSubida alElegir={(fs) => subir(fs)} ocupado={activo} />
      </div>

      <ZonaArrastre alSoltar={(fs) => subir(fs)} deshabilitada={activo}>
        {isLoading ? (
          <EsqueletoGaleria />
        ) : !piezas || piezas.length === 0 ? (
          <Vacio>Sin contenido en esta categoría todavía</Vacio>
        ) : (
          <div
            ref={gridRef}
            onMouseDown={alBajarEnGrilla}
            className="relative grid grid-cols-2 gap-3 select-none sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          >
            {piezas.map((p, i) => {
              const elegida = sel.has(p.id);
              return (
                <div
                  key={p.id}
                  data-id={p.id}
                  onClick={(e) => alClickPieza(e, p.id, i)}
                  className={`group relative aspect-square cursor-pointer overflow-hidden border bg-paper-dim transition-opacity ${
                    elegida ? "border-ink ring-2 ring-ink" : "border-gray-20"
                  } ${arrastre?.id === p.id ? "opacity-40" : ""} ${
                    // El lugar donde caería: un marco grueso adentro, para que se
                    // vea también sobre una foto clara.
                    arrastre && arrastre.sobre === i && arrastre.id !== p.id
                      ? "ring-4 ring-inset ring-marca"
                      : ""
                  }`}
                >
                  {p.tipo === "video" ? (
                    <video
                      src={p.url}
                      muted
                      playsInline
                      disablePictureInPicture
                      disableRemotePlayback
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}

                  {p.tipo === "video" && (
                    <span className="pointer-events-none absolute bottom-1.5 left-1.5 bg-ink/80 px-1.5 py-0.5 font-rotulo text-[9px] uppercase tracking-[0.08em] text-paper">
                      Video
                    </span>
                  )}

                  {/* El tilde de selección: no dispara el arrastre ni el visor. */}
                  <button
                    type="button"
                    data-no-marquee
                    onClick={(e) => {
                      e.stopPropagation();
                      if (e.shiftKey) rango(p.id);
                      else alternar(p.id);
                    }}
                    aria-label={
                      elegida ? "Quitar de la selección" : "Seleccionar"
                    }
                    className={`absolute top-1.5 left-1.5 grid h-6 w-6 place-items-center border text-[11px] transition-opacity ${
                      elegida
                        ? "border-ink bg-ink text-paper opacity-100"
                        : "border-paper bg-paper/70 text-transparent opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    ✓
                  </button>

                  {/* Portadas: las primeras de la lista son las que salen en la
                    landing, alternándose. En esas va un sello con su turno; en
                    las demás, un botón para subirlas al frente. */}
                  {i < MAX_PORTADAS ? (
                    <span className="pointer-events-none absolute top-1.5 right-1.5 flex items-center gap-1 bg-ink/85 px-1.5 py-1 font-rotulo text-[9px] uppercase tracking-[0.06em] text-paper">
                      <IconoEstrella className="h-2.5 w-2.5" />
                      Al frente
                    </span>
                  ) : (
                    <button
                      type="button"
                      data-no-marquee
                      onClick={(e) => {
                        e.stopPropagation();
                        marcarPortada.mutate({ id: p.id });
                      }}
                      disabled={marcarPortada.isPending}
                      aria-label="Poner al frente"
                      className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center border border-paper bg-paper/70 text-ink opacity-0 transition-opacity hover:bg-ink hover:text-paper group-hover:opacity-100"
                    >
                      <IconoEstrella className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Mover un lugar. Abajo y no arriba porque arriba ya viven la
                      selección y la portada, y tres controles en la misma
                      esquina se tocan entre sí con el dedo.

                      "Poner al frente" sigue estando y hace otra cosa: salta
                      hasta la primera posición. Esto acomoda de a uno, que es lo
                      que hace falta cuando la foto ya está cerca de su lugar. */}
                  {tactil ? (
                    <div className="absolute right-1.5 bottom-1.5 flex gap-1">
                      <BotonMover
                        direccion="sube"
                        deshabilitado={i === 0 || moverPieza.isPending}
                        alMover={() =>
                          moverPieza.mutate({ id: p.id, direccion: "sube" })
                        }
                      />
                      <BotonMover
                        direccion="baja"
                        deshabilitado={
                          i === piezas.length - 1 || moverPieza.isPending
                        }
                        alMover={() =>
                          moverPieza.mutate({ id: p.id, direccion: "baja" })
                        }
                      />
                    </div>
                  ) : (
                    // El tirador. `data-no-marquee` para que agarrarlo no empiece
                    // una selección por rectángulo, que es lo que hace bajar el
                    // mouse en cualquier otra parte de la grilla.
                    <button
                      type="button"
                      data-no-marquee
                      onPointerDown={(e) => empezarArrastre(e, p.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Arrastrar para cambiar de lugar"
                      title="Arrastrá para cambiar de lugar"
                      className={`absolute right-1.5 bottom-1.5 grid h-6 w-6 cursor-grab touch-none place-items-center border border-paper bg-paper/70 text-ink transition-opacity hover:bg-ink hover:text-paper active:cursor-grabbing ${
                        arrastre
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <IconoPuntos className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}

            {overlay && (
              <div
                className="pointer-events-none absolute z-10 border border-ink bg-ink/10"
                style={overlay}
              />
            )}
          </div>
        )}
      </ZonaArrastre>

      {/* Barra de selección: aparece con algo elegido. */}
      {sel.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 border border-ink bg-paper px-5 py-3 shadow-[4px_4px_0_rgba(0,0,0,0.12)]">
          <span className="font-rotulo text-[12px] uppercase tracking-[0.06em]">
            {sel.size} seleccionada{sel.size > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={() => setSel(new Set())}
            className="cursor-pointer font-rotulo text-[11.5px] uppercase tracking-[0.06em] text-gray-45 hover:text-ink"
          >
            Deseleccionar
          </button>
          <button
            type="button"
            onClick={() => setConfirmar(true)}
            className="inline-flex cursor-pointer items-center gap-2 border border-marca px-3.5 py-2 font-rotulo text-[11.5px] uppercase tracking-[0.05em] text-marca hover:bg-marca hover:text-paper"
          >
            <IconoPapelera className="h-3.5 w-3.5" />
            Eliminar
          </button>
        </div>
      )}

      <Modal
        abierto={confirmar}
        alCerrar={() => setConfirmar(false)}
        eyebrow={nombre}
        titulo={`Eliminar ${sel.size} pieza${sel.size > 1 ? "s" : ""}`}
      >
        <p className="text-[14px] leading-relaxed text-gray-70">
          Se borran del bucket y de la vitrina. No se puede deshacer.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Boton variante="fantasma" onClick={() => setConfirmar(false)}>
            Cancelar
          </Boton>
          <button
            type="button"
            onClick={() => eliminar.mutate({ ids: [...sel] })}
            disabled={eliminar.isPending}
            className="inline-flex items-center gap-2 border border-marca bg-marca px-[22px] py-[13px] font-rotulo text-[13px] uppercase tracking-[0.04em] text-paper transition-colors hover:bg-transparent hover:text-marca disabled:opacity-40"
          >
            <IconoPapelera />
            {eliminar.isPending ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </Modal>

      <Lightbox
        piezas={piezas ?? []}
        indice={visor}
        alCambiar={setVisor}
        alCerrar={() => setVisor(null)}
      />

      <SubidaPopover cola={cola} activo={activo} alCerrar={limpiar} />
    </>
  );
}

/**
 * Una flecha para mover la pieza un lugar.
 *
 * `data-no-marquee` la saca del arrastre que dibuja el rectángulo de selección:
 * sin eso, apretar la flecha empezaría a seleccionar en vez de mover.
 *
 * En los bordes se deshabilita en lugar de esconderse. Que el control esté y no
 * responda dice "es la primera"; que desaparezca deja al ojo buscándolo.
 */
function BotonMover({
  direccion,
  deshabilitado,
  alMover,
}: {
  direccion: "sube" | "baja";
  deshabilitado: boolean;
  alMover: () => void;
}) {
  const sube = direccion === "sube";
  return (
    <button
      type="button"
      data-no-marquee
      onClick={(e) => {
        e.stopPropagation();
        alMover();
      }}
      disabled={deshabilitado}
      aria-label={sube ? "Mover antes" : "Mover después"}
      className="grid h-6 w-6 place-items-center border border-paper bg-paper/70 text-ink transition-colors hover:bg-ink hover:text-paper disabled:cursor-default disabled:opacity-30 disabled:hover:bg-paper/70 disabled:hover:text-ink"
    >
      <IconoBajar className={`h-3 w-3 ${sube ? "rotate-180" : ""}`} />
    </button>
  );
}
