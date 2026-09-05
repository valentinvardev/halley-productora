"use client";

import { useRef, useState } from "react";

import {
  IconoAlerta,
  IconoBajar,
  IconoMas,
  IconoPapelera,
} from "~/app/_components/iconos";
import { Modal } from "~/app/_components/modal";
import {
  Boton,
  BotonTexto,
  Campo,
  CampoTexto,
  Vacio,
} from "~/app/_components/ui";
import { idDeYoutube, miniaturaYoutube } from "~/app/_datos/youtube";
import { api, type RouterOutputs } from "~/trpc/react";

import { SubidaPopover } from "./subida-popover";
import { useCargaContenido } from "./usar-carga";

/**
 * Los videos de una categoría, en un solo lugar.
 *
 * Se abre desde la tarjeta de la categoría en Contenidos, al lado de "Subir".
 * Adentro están los videos que ya hay, cada uno con su título y su descripción
 * para editar, para ordenar y para sacar; y las dos formas de agregar uno: pegar
 * un link de YouTube no listado, o subir el archivo.
 *
 * Es un modal y no una pantalla porque la tarea es corta y puntual: "cargá estos
 * tres videos con sus títulos" se hace en un minuto, y una pantalla aparte para
 * eso obliga a irse y volver.
 *
 * Los videos son piezas de la categoría como las fotos, así que ordenar acá es
 * ordenar la lista entera de la categoría moviendo sólo los videos entre sí. Se
 * manda la lista completa, igual que hace el arrastre de la galería: describir
 * el resultado y no el movimiento es lo que evita que dos clics se pisen.
 */

type Pieza = RouterOutputs["contenido"]["listar"][number];

export function VideosCategoria({
  slug,
  nombre,
  abierto,
  alCerrar,
}: {
  slug: string;
  nombre: string;
  abierto: boolean;
  alCerrar: () => void;
}) {
  const utils = api.useUtils();
  const { data: piezas } = api.contenido.listar.useQuery(
    { categoria: slug },
    { enabled: abierto },
  );
  const refrescar = () =>
    utils.contenido.listar.invalidate({ categoria: slug });

  const videos = (piezas ?? []).filter((p) => p.tipo === "video");

  const [editando, setEditando] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<Pieza | null>(null);
  const [link, setLink] = useState("");

  const archivoRef = useRef<HTMLInputElement>(null);
  const { cola, activo, subir, limpiar } = useCargaContenido(slug, refrescar);

  const agregar = api.contenido.agregarYoutube.useMutation({
    onSuccess: () => {
      setLink("");
      void refrescar();
    },
  });
  const editar = api.contenido.editarTexto.useMutation({
    onSuccess: () => {
      setEditando(null);
      void refrescar();
    },
  });
  const borrar = api.contenido.eliminar.useMutation({
    onSuccess: () => {
      setABorrar(null);
      void refrescar();
    },
  });
  const reordenar = api.contenido.reordenar.useMutation({
    onSettled: refrescar,
  });

  /**
   * Mover un video un lugar entre los videos.
   *
   * La categoría tiene fotos y videos mezclados en un solo orden. Acá se
   * intercambian las posiciones de este video y del video vecino, dejando a las
   * fotos donde están, y se manda la lista entera.
   */
  function mover(id: string, direccion: "sube" | "baja") {
    if (!piezas) return;
    const ids = piezas.map((p) => p.id);
    const indicesDeVideos = piezas
      .map((p, i) => (p.tipo === "video" ? i : -1))
      .filter((i) => i >= 0);
    const pos = indicesDeVideos.findIndex((i) => piezas[i]!.id === id);
    const vecino = indicesDeVideos[direccion === "sube" ? pos - 1 : pos + 1];
    const propio = indicesDeVideos[pos];
    if (vecino === undefined || propio === undefined) return;
    [ids[propio], ids[vecino]] = [ids[vecino]!, ids[propio]!];
    reordenar.mutate({ categoria: slug, ids });
  }

  const idPegado = idDeYoutube(link);

  return (
    <>
      <Modal
        abierto={abierto}
        alCerrar={alCerrar}
        eyebrow={nombre}
        titulo="Videos"
        ancho="w-[min(760px,calc(100vw-2rem))]"
      >
        <p className="nota max-w-[60ch] text-[13px]">
          Salen en la página de videos de {nombre.toLowerCase()} y en su
          galería, en este orden. Un video de YouTube tiene que ser público o no
          listado: uno privado no se puede mostrar.
        </p>

        {/* ------------------------------------------------------ agregar */}
        <div className="mt-5 grid gap-3 border border-gray-20 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Campo
            label="Link de YouTube"
            placeholder="https://youtu.be/…"
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              // El aviso de repetido se va al tocar el link: ya no describe lo que hay.
              agregar.reset();
            }}
            hint={
              link && !idPegado
                ? "No parece un link de YouTube."
                : "Se pega el link del video y listo."
            }
          />
          <Boton
            onClick={() => agregar.mutate({ categoria: slug, url: link })}
            disabled={!idPegado || agregar.isPending}
          >
            <IconoMas />
            {agregar.isPending ? "Agregando…" : "Agregar"}
          </Boton>
          <div className="sm:mb-[26px]">
            <input
              ref={archivoRef}
              type="file"
              accept="video/mp4,video/webm"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void subir(e.target.files);
                e.target.value = "";
              }}
            />
            <Boton
              variante="fantasma"
              onClick={() => archivoRef.current?.click()}
              disabled={activo}
            >
              {activo ? "Subiendo…" : "O subir un archivo"}
            </Boton>
          </div>
        </div>
        {agregar.error && (
          <p className="nota mt-2 text-[12px] text-marca">
            {agregar.error.message}
          </p>
        )}

        {/* -------------------------------------------------------- lista */}
        <div className="mt-6">
          {!piezas ? (
            <p className="nota">Cargando…</p>
          ) : videos.length === 0 ? (
            <Vacio>
              Todavía no hay videos en {nombre.toLowerCase()}. Sin videos, la
              página de servicio no muestra el botón "Ver videos".
            </Vacio>
          ) : (
            <div className="border border-ink">
              {videos.map((v, i) => (
                <FilaVideo
                  key={v.id}
                  video={v}
                  primero={i === 0}
                  ultimo={i === videos.length - 1}
                  editando={editando === v.id}
                  guardando={editar.isPending}
                  alEditar={() => setEditando(editando === v.id ? null : v.id)}
                  alGuardar={(titulo, descripcion) =>
                    editar.mutate({ id: v.id, titulo, descripcion })
                  }
                  alBorrar={() => setABorrar(v)}
                  alMover={(d) => mover(v.id, d)}
                  moviendo={reordenar.isPending}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Boton variante="fantasma" onClick={alCerrar}>
            Listo
          </Boton>
        </div>
      </Modal>

      <Modal
        abierto={aBorrar !== null}
        alCerrar={() => setABorrar(null)}
        eyebrow={nombre}
        titulo="Sacar el video"
      >
        <p className="flex items-start gap-2.5 text-[14px] leading-relaxed text-gray-70">
          <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {aBorrar?.youtubeId
              ? "Se saca de la vitrina. El video sigue en YouTube: acá sólo estaba el link."
              : "Se borra del bucket y de la vitrina. No se puede deshacer."}
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
            {borrar.isPending ? "Sacando…" : "Sacar"}
          </Boton>
        </div>
      </Modal>

      <SubidaPopover cola={cola} activo={activo} alCerrar={limpiar} />
    </>
  );
}

/* --------------------------------------------------------------------- fila */

function FilaVideo({
  video,
  primero,
  ultimo,
  editando,
  guardando,
  moviendo,
  alEditar,
  alGuardar,
  alBorrar,
  alMover,
}: {
  video: Pieza;
  primero: boolean;
  ultimo: boolean;
  editando: boolean;
  guardando: boolean;
  moviendo: boolean;
  alEditar: () => void;
  alGuardar: (titulo: string, descripcion: string) => void;
  alBorrar: () => void;
  alMover: (direccion: "sube" | "baja") => void;
}) {
  const [titulo, setTitulo] = useState(video.titulo ?? "");
  const [descripcion, setDescripcion] = useState(video.descripcion ?? "");

  return (
    <div className="border-b border-gray-20 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
        <div className="flex shrink-0 flex-col">
          <button
            type="button"
            onClick={() => alMover("sube")}
            disabled={primero || moviendo}
            aria-label="Subir"
            className="cursor-pointer px-1 text-gray-45 hover:text-ink disabled:cursor-default disabled:opacity-25"
          >
            <IconoBajar className="h-3 w-3 rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => alMover("baja")}
            disabled={ultimo || moviendo}
            aria-label="Bajar"
            className="cursor-pointer px-1 text-gray-45 hover:text-ink disabled:cursor-default disabled:opacity-25"
          >
            <IconoBajar className="h-3 w-3" />
          </button>
        </div>

        {/* El cuadro: la miniatura de YouTube, o el primer cuadro del archivo. */}
        <div className="relative h-14 w-24 shrink-0 overflow-hidden border border-gray-20 bg-black">
          {video.youtubeId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={miniaturaYoutube(video.youtubeId)}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <video
              src={video.url}
              muted
              playsInline
              preload="metadata"
              disablePictureInPicture
              disableRemotePlayback
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <button
          type="button"
          onClick={alEditar}
          className="min-w-0 flex-1 cursor-pointer text-left"
          aria-expanded={editando}
        >
          <span className="block text-[14px]">
            {video.titulo ?? <span className="text-gray-45">Sin título</span>}
          </span>
          {video.descripcion && (
            <span className="nota block truncate text-[12px]">
              {video.descripcion}
            </span>
          )}
          <span className="mt-0.5 block font-rotulo text-[10.5px] tracking-[0.06em] text-gray-45 uppercase">
            {video.youtubeId ? "YouTube" : "Archivo"} ·{" "}
            {editando ? "cerrar" : "editar título y descripción"}
          </span>
        </button>

        <BotonTexto onClick={alBorrar} className="text-gray-45">
          <IconoPapelera />
        </BotonTexto>
      </div>

      {editando && (
        <div className="grid gap-4 border-t border-dashed border-gray-20 bg-paper-dim px-4 py-4">
          <Campo
            label="Título"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Entrada al salón"
            maxLength={80}
            autoFocus
          />
          <CampoTexto
            label="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            maxLength={400}
            placeholder="De qué se trata, en una o dos frases. Opcional."
          />
          <div className="flex justify-end">
            <Boton
              onClick={() => alGuardar(titulo.trim(), descripcion.trim())}
              disabled={guardando}
            >
              {guardando ? "Guardando…" : "Guardar"}
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}
