"use client";

import { useRef, useState } from "react";

import { IconoMas, IconoPapelera } from "~/app/_components/iconos";
import { Modal } from "~/app/_components/modal";
import { Boton, Vacio } from "~/app/_components/ui";
import { api } from "~/trpc/react";
import { SubidaPopover } from "./subida-popover";
import { useCargaGaleria } from "./usar-carga-galeria";

const ACEPTA = "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm";

/**
 * El material de una galería de entrega, del lado del admin.
 *
 * Es la contracara de lo que ve la familia: se suben las fotos —las mismas que
 * después baja el padre—, se ven en grilla y se borran en tanda. La subida
 * reusa la cola con progreso; el borrado saca la foto del bucket y de la base.
 */
export function FotosGaleria({ galeriaId }: { galeriaId: string }) {
  const utils = api.useUtils();
  const { data: fotos, isLoading } = api.galeria.listar.useQuery({ galeriaId });

  const inputRef = useRef<HTMLInputElement>(null);
  const { cola, activo, subir, limpiar } = useCargaGaleria(galeriaId, () =>
    utils.galeria.listar.invalidate({ galeriaId }),
  );

  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirmar, setConfirmar] = useState(false);

  const eliminar = api.galeria.eliminarFotos.useMutation({
    onSuccess: async () => {
      setSel(new Set());
      setConfirmar(false);
      await utils.galeria.listar.invalidate({ galeriaId });
    },
  });

  function alternar(id: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className="mt-3 border-t border-gray-20 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-rotulo text-[11px] uppercase tracking-[0.08em] text-gray-45">
          {fotos?.length ?? 0} {fotos?.length === 1 ? "archivo" : "archivos"} de
          entrega
        </div>
        <Boton
          variante="fantasma"
          onClick={() => inputRef.current?.click()}
          disabled={activo}
        >
          <IconoMas />
          Subir fotos
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
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse bg-paper-dim" />
          ))}
        </div>
      ) : !fotos || fotos.length === 0 ? (
        <Vacio>Sin fotos subidas todavía</Vacio>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          {fotos.map((f) => {
            const elegida = sel.has(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => alternar(f.id)}
                className={`group relative aspect-square overflow-hidden border bg-paper-dim ${
                  elegida ? "border-ink ring-2 ring-ink" : "border-gray-20"
                }`}
              >
                {f.tipo === "video" ? (
                  <video src={f.url} muted playsInline className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt="" className="h-full w-full object-cover" />
                )}
                <span
                  className={`absolute top-1 left-1 grid h-5 w-5 place-items-center border text-[10px] transition-opacity ${
                    elegida
                      ? "border-ink bg-ink text-paper opacity-100"
                      : "border-paper bg-paper/70 text-transparent opacity-0 group-hover:opacity-100"
                  }`}
                >
                  ✓
                </span>
                {f.tipo === "video" && (
                  <span className="pointer-events-none absolute bottom-1 left-1 bg-ink/80 px-1 py-0.5 font-rotulo text-[8px] uppercase tracking-[0.08em] text-paper">
                    Video
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {sel.size > 0 && (
        <div className="mt-3 flex items-center gap-4">
          <span className="font-rotulo text-[11px] uppercase tracking-[0.06em]">
            {sel.size} seleccionada{sel.size > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={() => setSel(new Set())}
            className="cursor-pointer font-rotulo text-[11px] uppercase tracking-[0.06em] text-gray-45 hover:text-ink"
          >
            Deseleccionar
          </button>
          <button
            type="button"
            onClick={() => setConfirmar(true)}
            className="inline-flex cursor-pointer items-center gap-2 border border-marca px-3 py-1.5 font-rotulo text-[11px] uppercase tracking-[0.05em] text-marca hover:bg-marca hover:text-paper"
          >
            <IconoPapelera className="h-3.5 w-3.5" />
            Eliminar
          </button>
        </div>
      )}

      <Modal
        abierto={confirmar}
        alCerrar={() => setConfirmar(false)}
        eyebrow="Galería"
        titulo={`Eliminar ${sel.size} archivo${sel.size > 1 ? "s" : ""}`}
      >
        <p className="text-[14px] leading-relaxed text-gray-70">
          Se borran del bucket y de la galería de la familia. No se puede
          deshacer.
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

      <SubidaPopover cola={cola} activo={activo} alCerrar={limpiar} />
    </div>
  );
}
