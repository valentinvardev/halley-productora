"use client";

import Link from "next/link";
import { useRef } from "react";

import { IconoFlecha, IconoMas } from "~/app/_components/iconos";
import { Encabezado } from "~/app/_components/ui";
import { CATEGORIAS } from "~/app/_datos/categorias";
import { api } from "~/trpc/react";
import { EsqueletoContenidos } from "./esqueletos";
import { SubidaPopover } from "./subida-popover";
import { useCargaContenido } from "./usar-carga";

const ACEPTA = "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm";

/** Cuántas piezas se muestran de preview en la tarjeta del resumen. */
const PREVIEW = 5;

export function Contenidos() {
  const { data: estado, isLoading } = api.contenido.estado.useQuery();

  if (isLoading) return <EsqueletoContenidos />;

  return (
    <>
      <Encabezado
        eyebrow="Vitrina"
        titulo="Contenidos"
        bajada="Lo que subís acá es lo que muestra la landing en cada categoría. Entrá a una para verla completa, seleccionar y ordenar; mientras esté vacía, la landing usa las imágenes de relleno."
      />

      {estado && !estado.s3 && (
        <div className="nota mb-8 border border-marca px-4 py-3 text-marca">
          El almacenamiento no está configurado: falta{" "}
          <code className="font-mono text-[12px]">AWS_S3_BUCKET</code> y las
          credenciales en <code className="font-mono text-[12px]">.env</code>.
          La subida está deshabilitada hasta entonces.
        </div>
      )}

      <div className="grid gap-5">
        {CATEGORIAS.map((c) => (
          <TarjetaCategoria
            key={c.slug}
            slug={c.slug}
            nombre={c.nombre}
            habilitado={estado?.s3 ?? false}
          />
        ))}
      </div>
    </>
  );
}

function TarjetaCategoria({
  slug,
  nombre,
  habilitado,
}: {
  slug: string;
  nombre: string;
  habilitado: boolean;
}) {
  const utils = api.useUtils();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: piezas } = api.contenido.listar.useQuery({ categoria: slug });
  const { cola, activo, subir, limpiar } = useCargaContenido(slug, () =>
    utils.contenido.listar.invalidate({ categoria: slug }),
  );

  const total = piezas?.length ?? 0;
  const preview = piezas?.slice(0, PREVIEW) ?? [];
  const resto = total - preview.length;

  return (
    <section className="border border-ink">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink px-5 py-3.5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-titulo text-[20px] uppercase">{nombre}</h2>
          <span className="font-rotulo text-[11px] uppercase tracking-[0.08em] text-gray-45">
            {total} {total === 1 ? "pieza" : "piezas"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={!habilitado || activo}
            className="inline-flex cursor-pointer items-center gap-2 border border-ink px-3.5 py-2 font-rotulo text-[11.5px] uppercase tracking-[0.05em] hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconoMas />
            Subir
          </button>
          <Link
            href={`/admin/contenidos/${slug}`}
            className="inline-flex items-center gap-2 border border-ink px-3.5 py-2 font-rotulo text-[11.5px] uppercase tracking-[0.05em] hover:bg-ink hover:text-paper"
          >
            Ver galería
            <IconoFlecha />
          </Link>
        </div>

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
      </header>

      <div className="p-5">
        {total === 0 ? (
          <p className="nota text-gray-45">
            {habilitado
              ? "Sin contenido — la landing muestra el relleno de esta categoría."
              : "Configurá S3 para poder subir."}
          </p>
        ) : (
          <Link
            href={`/admin/contenidos/${slug}`}
            className="grid grid-cols-3 gap-3 sm:grid-cols-5"
          >
            {preview.map((p) => (
              <div
                key={p.id}
                className="relative aspect-square overflow-hidden border border-gray-20 bg-paper-dim"
              >
                {p.tipo === "video" ? (
                  <video src={p.url} muted playsInline className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                )}
                {/* En la última del preview, cuántas más hay. */}
                {resto > 0 && p.id === preview[preview.length - 1]!.id && (
                  <div className="absolute inset-0 grid place-items-center bg-ink/60 font-titulo text-[22px] text-paper">
                    +{resto}
                  </div>
                )}
              </div>
            ))}
          </Link>
        )}
      </div>

      <SubidaPopover cola={cola} activo={activo} alCerrar={limpiar} />
    </section>
  );
}
