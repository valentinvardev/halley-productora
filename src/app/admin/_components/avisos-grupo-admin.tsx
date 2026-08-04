"use client";

import { useState } from "react";

import { IconoFlecha, IconoMas, IconoPapelera } from "~/app/_components/iconos";
import {
  Boton,
  BotonTexto,
  Campo,
  CampoTexto,
  Tag,
  Vacio,
} from "~/app/_components/ui";
import { api, type RouterOutputs } from "~/trpc/react";
import { BotonesSubida } from "./botones-subida";
import { SubidaPopover } from "./subida-popover";
import { useCargaAviso } from "./usar-carga-aviso";

type Aviso = RouterOutputs["aviso"]["listar"][number];

/**
 * La información que el grupo le muestra a sus familias.
 *
 * Es lo que antes iba por WhatsApp y se perdía: fechas, qué llevar, cómo se
 * entrega. Se escribe acá y aparece en el panel de cada familia, con las fotos
 * que se le adjunten.
 */
export function AvisosGrupoAdmin({ grupoId }: { grupoId: string }) {
  const utils = api.useUtils();
  const { data: avisos, isLoading } = api.aviso.listar.useQuery({ grupoId });
  const [creando, setCreando] = useState(false);

  const refrescar = () => utils.aviso.listar.invalidate({ grupoId });

  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between">
        <div className="eyebrow">Información para las familias</div>
        {!creando && (
          <BotonTexto onClick={() => setCreando(true)}>
            <IconoMas />
            Agregar aviso
          </BotonTexto>
        )}
      </div>

      {creando && (
        <Formulario
          grupoId={grupoId}
          alTerminar={async () => {
            setCreando(false);
            await refrescar();
          }}
          alCancelar={() => setCreando(false)}
        />
      )}

      {!isLoading && avisos?.length === 0 && !creando && (
        <Vacio>Sin avisos — lo que cargues acá lo ve la familia en su panel</Vacio>
      )}

      <div className="grid gap-3">
        {avisos?.map((a, i) => (
          <Tarjeta
            key={a.id}
            aviso={a}
            grupoId={grupoId}
            primera={i === 0}
            ultima={i === avisos.length - 1}
            alCambiar={refrescar}
          />
        ))}
      </div>
    </div>
  );
}

function Tarjeta({
  aviso,
  grupoId,
  primera,
  ultima,
  alCambiar,
}: {
  aviso: Aviso;
  grupoId: string;
  primera: boolean;
  ultima: boolean;
  alCambiar: () => Promise<unknown>;
}) {
  const [editando, setEditando] = useState(false);
  const utils = api.useUtils();

  const mover = api.aviso.mover.useMutation({ onSuccess: alCambiar });
  const eliminar = api.aviso.eliminar.useMutation({ onSuccess: alCambiar });
  const eliminarFoto = api.aviso.eliminarFoto.useMutation({ onSuccess: alCambiar });

  const { cola, activo, subir, limpiar } = useCargaAviso(aviso.id, () =>
    utils.aviso.listar.invalidate({ grupoId }),
  );

  return (
    <div className="border border-gray-20 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px]">{aviso.titulo}</span>
            {!aviso.publicado && <Tag>Borrador</Tag>}
          </div>
          <p className="nota mt-1 line-clamp-2 max-w-[70ch] text-[12px]">
            {aviso.cuerpo}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => mover.mutate({ id: aviso.id, direccion: "arriba" })}
            disabled={primera || mover.isPending}
            aria-label="Subir"
            className="grid h-7 w-7 -rotate-90 place-items-center text-gray-45 hover:text-ink disabled:opacity-25"
          >
            <IconoFlecha className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => mover.mutate({ id: aviso.id, direccion: "abajo" })}
            disabled={ultima || mover.isPending}
            aria-label="Bajar"
            className="grid h-7 w-7 rotate-90 place-items-center text-gray-45 hover:text-ink disabled:opacity-25"
          >
            <IconoFlecha className="h-3.5 w-3.5" />
          </button>
          <BotonTexto onClick={() => setEditando((v) => !v)}>
            {editando ? "Cerrar" : "Editar"}
          </BotonTexto>
          <BotonTexto
            onClick={() => eliminar.mutate({ id: aviso.id })}
            className="text-gray-45"
          >
            Eliminar
          </BotonTexto>
        </div>
      </div>

      {/* Fotos del aviso */}
      <div className="mt-4 border-t border-gray-20 pt-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <span className="font-rotulo text-[10.5px] uppercase tracking-[0.08em] text-gray-45">
            {aviso.fotos.length}{" "}
            {aviso.fotos.length === 1 ? "imagen" : "imágenes"}
          </span>
          <BotonesSubida alElegir={(fs) => subir(fs)} ocupado={activo} />
        </div>

        {aviso.fotos.length > 0 && (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {aviso.fotos.map((f) => (
              <div
                key={f.id}
                className="group relative aspect-square overflow-hidden border border-gray-20 bg-paper-dim"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => eliminarFoto.mutate({ id: f.id })}
                  aria-label="Quitar"
                  className="absolute top-1 right-1 grid h-6 w-6 place-items-center border border-paper bg-paper/80 text-marca opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <IconoPapelera className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <SubidaPopover cola={cola} activo={activo} alCerrar={limpiar} />

      {editando && (
        <div className="mt-4 border-t border-gray-20 pt-4">
          <Formulario
            grupoId={grupoId}
            aviso={aviso}
            alTerminar={async () => {
              setEditando(false);
              await alCambiar();
            }}
            alCancelar={() => setEditando(false)}
          />
        </div>
      )}
    </div>
  );
}

function Formulario({
  grupoId,
  aviso,
  alTerminar,
  alCancelar,
}: {
  grupoId: string;
  aviso?: Aviso;
  alTerminar: () => Promise<unknown>;
  alCancelar: () => void;
}) {
  const [titulo, setTitulo] = useState(aviso?.titulo ?? "");
  const [cuerpo, setCuerpo] = useState(aviso?.cuerpo ?? "");
  const [publicado, setPublicado] = useState(aviso?.publicado ?? true);

  const guardar = api.aviso.guardar.useMutation({ onSuccess: alTerminar });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        guardar.mutate({
          id: aviso?.id,
          grupoId,
          titulo: titulo.trim(),
          cuerpo: cuerpo.trim(),
          publicado,
        });
      }}
      className="grid gap-4"
    >
      <Campo
        label="Título"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Sesión de fotos — 12 de septiembre"
        required
      />
      <CampoTexto
        label="Texto"
        rows={5}
        value={cuerpo}
        onChange={(e) => setCuerpo(e.target.value)}
        placeholder="Nos encontramos a las 9 en la puerta del colegio. Llevar el uniforme de gala…"
        hint="Los saltos de línea se respetan tal como los escribas."
      />

      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={publicado}
          onChange={(e) => setPublicado(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-ink)]"
        />
        <span className="font-rotulo text-[11.5px] uppercase tracking-[0.06em]">
          Visible para las familias
        </span>
      </label>

      {guardar.error && <p className="nota text-marca">{guardar.error.message}</p>}

      <div className="flex flex-wrap gap-3">
        <Boton type="submit" disabled={guardar.isPending || titulo.trim().length < 2}>
          {guardar.isPending ? "Guardando…" : "Guardar"}
        </Boton>
        <Boton type="button" variante="fantasma" onClick={alCancelar}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}
