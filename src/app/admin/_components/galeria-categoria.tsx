"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import {
  IconoEstrella,
  IconoMas,
  IconoPapelera,
  IconoVolver,
} from "~/app/_components/iconos";
import { Modal } from "~/app/_components/modal";
import { Boton, Vacio } from "~/app/_components/ui";
import { api } from "~/trpc/react";
import { EsqueletoGaleria } from "./esqueletos";
import { Lightbox } from "./lightbox";
import { SubidaPopover } from "./subida-popover";
import { useCargaContenido } from "./usar-carga";

const ACEPTA = "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm";

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

  const inputRef = useRef<HTMLInputElement>(null);
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
      gridRef.current?.querySelectorAll<HTMLElement>("[data-id]").forEach((el) => {
        const b = el.getBoundingClientRect();
        const fuera =
          b.right < r.left || b.left > r.right || b.bottom < r.top || b.top > r.bottom;
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
            arrastrá el mouse o usá el tilde para seleccionar · la estrella marca
            la portada
          </p>
        </div>

        <Boton onClick={() => inputRef.current?.click()} disabled={activo}>
          <IconoMas />
          Subir
        </Boton>
        <input
          ref={inputRef}
          type="file"
          accept={ACEPTA}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void subir(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

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
                className={`group relative aspect-square cursor-pointer overflow-hidden border bg-paper-dim ${
                  elegida ? "border-ink ring-2 ring-ink" : "border-gray-20"
                }`}
              >
                {p.tipo === "video" ? (
                  <video src={p.url} muted playsInline className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
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
                  aria-label={elegida ? "Quitar de la selección" : "Seleccionar"}
                  className={`absolute top-1.5 left-1.5 grid h-6 w-6 place-items-center border text-[11px] transition-opacity ${
                    elegida
                      ? "border-ink bg-ink text-paper opacity-100"
                      : "border-paper bg-paper/70 text-transparent opacity-0 group-hover:opacity-100"
                  }`}
                >
                  ✓
                </button>

                {/* Portada: la primera de la lista es la que sale en la landing.
                    En esa va un sello; en las demás, un botón para elegirla. */}
                {i === 0 ? (
                  <span className="pointer-events-none absolute top-1.5 right-1.5 flex items-center gap-1 bg-ink/85 px-1.5 py-1 font-rotulo text-[9px] uppercase tracking-[0.06em] text-paper">
                    <IconoEstrella className="h-2.5 w-2.5" />
                    Portada
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
                    aria-label="Hacer portada"
                    className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center border border-paper bg-paper/70 text-ink opacity-0 transition-opacity hover:bg-ink hover:text-paper group-hover:opacity-100"
                  >
                    <IconoEstrella className="h-3.5 w-3.5" />
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
