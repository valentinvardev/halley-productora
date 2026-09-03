"use client";

import { IconoEstrella, IconoPapelera } from "~/app/_components/iconos";
import { BotonTexto, Encabezado, Tag, Vacio } from "~/app/_components/ui";
import { fecha } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * Las valoraciones: las pedidas, las que llegaron y las publicadas.
 *
 * Todo en una lista y no en tres, porque son la misma cosa en tres momentos.
 * Lo que importa de cada una se lee de un vistazo: si llegó, qué dijo y si
 * está saliendo en la portada. Publicar es un botón y despublicar es el mismo
 * botón: lo que sale en la web tiene que poder sacarse con la misma facilidad
 * con la que se puso.
 */
export function Valoraciones() {
  const utils = api.useUtils();
  const lista = api.valoracion.listar.useQuery();
  const refrescar = () => utils.valoracion.listar.invalidate();
  const publicar = api.valoracion.publicar.useMutation({
    onSuccess: refrescar,
  });
  const eliminar = api.valoracion.eliminar.useMutation({
    onSuccess: refrescar,
  });

  const filas = lista.data ?? [];
  const publicadas = filas.filter((v) => v.publicada).length;

  return (
    <>
      <Encabezado
        eyebrow="Panel"
        titulo="Valoraciones"
        bajada={`Lo que las familias dejaron después del evento. ${publicadas} ${publicadas === 1 ? "publicada" : "publicadas"} en la portada. Se piden desde la ficha de cada alumno.`}
      />

      {lista.isPending ? (
        <p className="nota mt-8">Cargando…</p>
      ) : filas.length === 0 ? (
        <Vacio>
          Todavía no se pidió ninguna. Se pide desde la ficha del alumno.
        </Vacio>
      ) : (
        <div className="mt-8 border border-ink">
          {filas.map((v) => (
            <article
              key={v.id}
              className="grid gap-4 border-b border-gray-20 px-5 py-4 last:border-b-0 lg:grid-cols-[auto_1fr_auto] lg:items-start"
            >
              {/* La foto, o el hueco donde iría. */}
              <div className="h-14 w-14 shrink-0 overflow-hidden border border-gray-20 bg-paper-dim">
                {v.fotoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.fotoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-rotulo text-[12px] tracking-[0.06em] uppercase">
                    {v.usadoEl ? v.nombre : "Pedida, sin respuesta"}
                  </span>
                  {v.usadoEl && <Estrellas cantidad={v.estrellas} />}
                  {v.publicada && <Tag activo>En la portada</Tag>}
                </div>
                <p className="nota mt-1 text-[12px]">
                  {[v.alumno, v.grupo].filter(Boolean).join(" · ")}
                  {" · "}
                  {v.usadoEl
                    ? `llegó el ${fecha(v.usadoEl)}`
                    : `enviada a ${v.email} el ${fecha(v.creadoEn)}, vence el ${fecha(v.expiraEl)}`}
                </p>
                {v.usadoEl && (
                  <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed">
                    {v.comentario}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 lg:flex-col lg:items-end">
                {v.usadoEl && (
                  <BotonTexto
                    onClick={() =>
                      publicar.mutate({ id: v.id, publicada: !v.publicada })
                    }
                    disabled={publicar.isPending}
                  >
                    {v.publicada ? "Sacar de la portada" : "Publicar"}
                  </BotonTexto>
                )}
                <BotonTexto
                  onClick={() => {
                    if (
                      confirm("¿Borrar esta valoración? No se puede deshacer.")
                    ) {
                      eliminar.mutate({ id: v.id });
                    }
                  }}
                  disabled={eliminar.isPending}
                >
                  <IconoPapelera className="h-3.5 w-3.5" />
                  Borrar
                </BotonTexto>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

/** Cinco estrellas, las primeras llenas. */
export function Estrellas({
  cantidad,
  className = "h-3.5 w-3.5",
}: {
  cantidad: number;
  className?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${cantidad} de 5 estrellas`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <IconoEstrella
          key={n}
          className={`${className} ${n <= cantidad ? "text-ink" : "text-gray-20"}`}
        />
      ))}
    </span>
  );
}
