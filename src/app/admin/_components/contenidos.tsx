"use client";

import { useRef, useState } from "react";

import { IconoImagen, IconoMas, IconoPapelera } from "~/app/_components/iconos";
import { Encabezado, Vacio } from "~/app/_components/ui";
import { CATEGORIAS } from "~/server/contenido";
import { api } from "~/trpc/react";

const ACEPTA = "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm";

export function Contenidos() {
  const { data: estado } = api.contenido.estado.useQuery();

  return (
    <>
      <Encabezado
        eyebrow="Vitrina"
        titulo="Contenidos"
        bajada="Lo que subís acá es lo que muestra la landing en cada categoría. Mientras una categoría esté vacía, la landing usa las imágenes de relleno."
      />

      {estado && !estado.s3 && (
        <div className="nota mb-8 border border-marca px-4 py-3 text-marca">
          El almacenamiento no está configurado: falta{" "}
          <code className="font-mono text-[12px]">AWS_S3_BUCKET</code> y las
          credenciales en <code className="font-mono text-[12px]">.env</code>.
          La subida está deshabilitada hasta entonces.
        </div>
      )}

      <div className="grid gap-10">
        {CATEGORIAS.map((c) => (
          <CategoriaContenido
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

function CategoriaContenido({
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
  const [subiendo, setSubiendo] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { data: piezas } = api.contenido.listar.useQuery({ categoria: slug });

  const firmar = api.contenido.urlDeSubida.useMutation();
  const guardar = api.contenido.guardar.useMutation();
  const eliminar = api.contenido.eliminar.useMutation({
    onSuccess: () => utils.contenido.listar.invalidate({ categoria: slug }),
  });

  async function subirUno(file: File) {
    // 1. Firmar la subida. 2. PUT directo a S3. 3. Guardar la pieza.
    const { url, key, tipo } = await firmar.mutateAsync({
      categoria: slug,
      contentType: file.type,
    });

    const put = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!put.ok) throw new Error(`S3 rechazó la subida (${put.status}).`);

    await guardar.mutateAsync({ categoria: slug, s3Key: key, tipo });
  }

  async function alElegir(archivos: FileList | null) {
    if (!archivos || archivos.length === 0) return;
    setError(null);
    setSubiendo(archivos.length);

    try {
      // De a uno: si una falla, las anteriores ya quedaron guardadas.
      for (const file of Array.from(archivos)) {
        await subirUno(file);
        setSubiendo((n) => n - 1);
      }
      await utils.contenido.listar.invalidate({ categoria: slug });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir.");
    } finally {
      setSubiendo(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="border border-ink">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink px-5 py-3.5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-titulo text-[20px] uppercase">{nombre}</h2>
          <span className="font-rotulo text-[11px] uppercase tracking-[0.08em] text-gray-45">
            {piezas?.length ?? 0}{" "}
            {piezas?.length === 1 ? "pieza" : "piezas"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!habilitado || subiendo > 0}
          className="inline-flex cursor-pointer items-center gap-2 border border-ink px-3.5 py-2 font-rotulo text-[11.5px] uppercase tracking-[0.05em] hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconoMas />
          {subiendo > 0 ? `Subiendo ${subiendo}…` : "Subir"}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={ACEPTA}
          multiple
          className="hidden"
          onChange={(e) => void alElegir(e.target.files)}
        />
      </header>

      <div className="p-5">
        {error && (
          <p className="nota mb-4 border border-marca px-3 py-2 text-marca">
            {error}
          </p>
        )}

        {!piezas || piezas.length === 0 ? (
          <Vacio>
            {habilitado
              ? "Sin contenido — la landing muestra el relleno de esta categoría"
              : "Configurá S3 para poder subir"}
          </Vacio>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {piezas.map((p) => (
              <div
                key={p.id}
                className="group relative aspect-[4/3] overflow-hidden border border-gray-20 bg-paper-dim"
              >
                {p.tipo === "video" ? (
                  <video
                    src={p.url}
                    muted
                    playsInline
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
                  <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-ink/80 px-1.5 py-0.5 font-rotulo text-[9px] uppercase tracking-[0.08em] text-paper">
                    <IconoImagen className="h-2.5 w-2.5" />
                    Video
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (confirm("¿Eliminar esta pieza?")) {
                      eliminar.mutate({ id: p.id });
                    }
                  }}
                  disabled={eliminar.isPending}
                  aria-label="Eliminar"
                  className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center bg-paper/85 text-ink opacity-0 transition-opacity hover:bg-marca hover:text-paper group-hover:opacity-100"
                >
                  <IconoPapelera className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
