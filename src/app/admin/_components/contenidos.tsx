"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { IconoFlecha, IconoMas, IconoPapelera } from "~/app/_components/iconos";
import { Encabezado } from "~/app/_components/ui";
import { CATEGORIAS, HERO } from "~/app/_datos/categorias";
import { api } from "~/trpc/react";
import { BotonesSubida } from "./botones-subida";
import { EsqueletoContenidos } from "./esqueletos";
import { SubidaPopover } from "./subida-popover";
import { useCargaContenido } from "./usar-carga";
import { useCargaHero } from "./usar-carga-hero";
import { ZonaArrastre } from "./zona-arrastre";

const ACEPTA =
  "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm";

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

      <TarjetaHero habilitado={estado?.s3 ?? false} />

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

/**
 * La portada del sitio: el video o la foto que ocupa la primera pantalla.
 *
 * Es una sola pieza, así que subir otra reemplaza a la anterior —y borra su
 * archivo del bucket— en vez de acumular. Sin nada subido, la landing usa el
 * respaldo que vive en el repo.
 */
function TarjetaHero({ habilitado }: { habilitado: boolean }) {
  const utils = api.useUtils();

  const { data: clips } = api.contenido.hero.useQuery();
  const { cola, activo, subir, limpiar } = useCargaHero(() =>
    utils.contenido.hero.invalidate(),
  );
  const eliminar = api.contenido.eliminarHero.useMutation({
    onSuccess: () => utils.contenido.hero.invalidate(),
  });

  const total = clips?.length ?? 0;

  return (
    <ZonaArrastre
      alSoltar={subir}
      deshabilitada={!habilitado || activo}
      className="border border-ink"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink px-5 py-3.5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-titulo text-[20px] uppercase">Portada</h2>
          <span className="font-rotulo text-[11px] uppercase tracking-[0.08em] text-gray-45">
            {total === 0
              ? "Sin subir"
              : `${total} ${total === 1 ? "clip" : "clips"}`}
          </span>
        </div>
        <BotonesSubida alElegir={subir} ocupado={!habilitado || activo} />
      </header>

      <div className="p-5">
        <p className="nota mb-4 max-w-[70ch]">
          Se ve a pantalla completa detrás del título. Conviene un video
          horizontal, corto y sin audio: se reproduce solo y en bucle.{" "}
          <strong className="font-semibold">
            Si cargás varios, cada visita abre con uno distinto.
          </strong>
        </p>

        {total === 0 ? (
          <p className="nota text-gray-45">
            {habilitado
              ? "Sin portada propia — la landing usa el video de respaldo del repo."
              : "Configurá S3 para poder subir."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {clips?.map((c) => (
              <div
                key={c.id}
                className="group relative aspect-video overflow-hidden border border-gray-20 bg-paper-dim"
              >
                {c.tipo === "video" ? (
                  <video
                    src={c.url}
                    muted
                    loop
                    playsInline
                    disablePictureInPicture
                    disableRemotePlayback
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => eliminar.mutate({ id: c.id })}
                  disabled={eliminar.isPending}
                  aria-label="Quitar de la portada"
                  className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center border border-paper bg-paper/85 text-marca opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <IconoPapelera className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <SubidaPopover cola={cola} activo={activo} alCerrar={limpiar} />
    </ZonaArrastre>
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
    <ZonaArrastre
      alSoltar={(fs) => subir(fs)}
      deshabilitada={!habilitado || activo}
      className="border border-ink"
    >
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
    </ZonaArrastre>
  );
}
