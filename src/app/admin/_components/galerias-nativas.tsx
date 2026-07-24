"use client";

import { useState } from "react";

import { Copiar } from "~/app/_components/copiar";
import { IconoCandado, IconoMas } from "~/app/_components/iconos";
import { Modal } from "~/app/_components/modal";
import {
  Boton,
  BotonTexto,
  Campo,
  Encabezado,
  Tag,
  Vacio,
} from "~/app/_components/ui";
import { fecha } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";
import { FotosGaleria } from "./fotos-galeria";

type GaleriaNativa = RouterOutputs["galeria"]["listarNativas"][number];

/**
 * Las galerías para compartir: sueltas, con su propio link y contraseña
 * opcional. Es la contracara de las galerías atadas a un grupo —acá no hay
 * cobro—: se crea, se suben las fotos, se copia el link y se manda.
 */
export function GaleriasNativas() {
  const utils = api.useUtils();
  const { data: galerias, isLoading } = api.galeria.listarNativas.useQuery();
  const [creando, setCreando] = useState(false);

  const refrescar = () => utils.galeria.listarNativas.invalidate();

  return (
    <>
      <Encabezado
        eyebrow="Galerías"
        titulo="Galerías para compartir"
        bajada="Galerías sueltas con su propio link. Le ponés contraseña si querés, y siempre tienen fecha de vencimiento. No dependen de ningún cobro."
        acciones={
          !creando ? (
            <Boton onClick={() => setCreando(true)}>
              <IconoMas />
              Nueva galería
            </Boton>
          ) : undefined
        }
      />

      {creando && <FormularioNueva alCerrar={() => setCreando(false)} />}

      {!isLoading && galerias?.length === 0 && !creando && (
        <Vacio>Todavía no hay galerías. Creá una y compartí el link.</Vacio>
      )}

      <div className="grid gap-4">
        {galerias?.map((g) => (
          <Tarjeta key={g.id} galeria={g} alCambiar={refrescar} />
        ))}
      </div>
    </>
  );
}

function FormularioNueva({ alCerrar }: { alCerrar: () => void }) {
  const utils = api.useUtils();
  const crear = api.galeria.crearNativa.useMutation({
    onSuccess: async () => {
      await utils.galeria.listarNativas.invalidate();
      alCerrar();
    },
  });

  const [titulo, setTitulo] = useState("");
  const [dias, setDias] = useState("30");
  const [password, setPassword] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        crear.mutate({
          titulo,
          dias: Number(dias),
          password: password.trim() || undefined,
        });
      }}
      className="mb-10 grid gap-5 border border-ink p-8"
    >
      <div className="eyebrow">Nueva galería</div>

      <Campo
        label="Título"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Casamiento Ana & Julián — selección"
        required
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Días de vigencia"
          type="number"
          min={1}
          max={3650}
          value={dias}
          onChange={(e) => setDias(e.target.value)}
          hint="Después de eso el link deja de funcionar."
          required
        />
        <Campo
          label="Contraseña (opcional)"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Dejala vacía para no pedir contraseña"
          autoComplete="off"
        />
      </div>

      {crear.error && <p className="nota text-marca">{crear.error.message}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Boton type="submit" disabled={crear.isPending || titulo.trim().length < 2}>
          {crear.isPending ? "Creando…" : "Crear galería"}
        </Boton>
        <Boton type="button" variante="fantasma" onClick={alCerrar}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}

function Tarjeta({
  galeria,
  alCambiar,
}: {
  galeria: GaleriaNativa;
  alCambiar: () => void;
}) {
  const [fotos, setFotos] = useState(false);
  const [editar, setEditar] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const eliminar = api.galeria.eliminarNativa.useMutation({
    onSuccess: () => {
      setConfirmar(false);
      alCambiar();
    },
  });

  return (
    <div className="border border-ink">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-20 px-5 py-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="text-[17px] leading-snug">{galeria.titulo}</h3>
            {galeria.tienePassword && (
              <Tag>
                <IconoCandado className="mr-1 inline h-3 w-3" />
                Con contraseña
              </Tag>
            )}
            {!galeria.vigente && <Tag>Vencida</Tag>}
          </div>
          <div className="font-rotulo text-[11.5px] uppercase tracking-[0.06em] text-gray-45">
            {galeria.fotos} {galeria.fotos === 1 ? "archivo" : "archivos"}
            {galeria.venceEl &&
              ` · ${galeria.vigente ? "vence" : "venció"} ${fecha(galeria.venceEl)}`}
          </div>
        </div>
      </div>

      {/* El link para compartir. */}
      {galeria.link && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-20 bg-paper-dim px-5 py-3">
          <span className="font-mono text-[12px] break-all">{galeria.link}</span>
          <div className="flex items-center gap-3">
            <a
              href={galeria.link}
              target="_blank"
              rel="noreferrer"
              className="font-rotulo text-[11.5px] uppercase tracking-[0.05em] underline underline-offset-2 hover:text-gray-70"
            >
              Abrir
            </a>
            <Copiar valor={galeria.link} etiqueta="Copiar link" />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 px-5 py-3">
        <BotonTexto onClick={() => setFotos((v) => !v)}>
          {fotos ? "Ocultar fotos" : "Administrar fotos"}
        </BotonTexto>
        <BotonTexto onClick={() => setEditar((v) => !v)}>
          {editar ? "Cerrar" : "Editar"}
        </BotonTexto>
        <BotonTexto onClick={() => setConfirmar(true)} className="text-gray-45">
          Eliminar
        </BotonTexto>
      </div>

      {editar && (
        <div className="border-t border-gray-20 px-5 py-4">
          <FormularioEditar
            galeria={galeria}
            alGuardar={() => {
              setEditar(false);
              alCambiar();
            }}
          />
        </div>
      )}

      {fotos && (
        <div className="px-5 pb-4">
          <FotosGaleria galeriaId={galeria.id} />
        </div>
      )}

      <Modal
        abierto={confirmar}
        alCerrar={() => setConfirmar(false)}
        eyebrow="Galería"
        titulo="Eliminar galería"
      >
        <p className="text-[14px] leading-relaxed text-gray-70">
          Se borran la galería, sus fotos del bucket y el link deja de funcionar.
          No se puede deshacer.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Boton variante="fantasma" onClick={() => setConfirmar(false)}>
            Cancelar
          </Boton>
          <button
            type="button"
            onClick={() => eliminar.mutate({ id: galeria.id })}
            disabled={eliminar.isPending}
            className="inline-flex items-center gap-2 border border-marca bg-marca px-[22px] py-[13px] font-rotulo text-[13px] uppercase tracking-[0.04em] text-paper transition-colors hover:bg-transparent hover:text-marca disabled:opacity-40"
          >
            {eliminar.isPending ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function FormularioEditar({
  galeria,
  alGuardar,
}: {
  galeria: GaleriaNativa;
  alGuardar: () => void;
}) {
  const actualizar = api.galeria.actualizarNativa.useMutation({
    onSuccess: alGuardar,
  });

  const [titulo, setTitulo] = useState(galeria.titulo);
  const [dias, setDias] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        actualizar.mutate({
          id: galeria.id,
          titulo: titulo.trim() !== galeria.titulo ? titulo.trim() : undefined,
          dias: dias ? Number(dias) : undefined,
          password: password.trim() || undefined,
        });
      }}
      className="grid gap-4"
    >
      <Campo
        label="Título"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Renovar vigencia (días desde hoy)"
          type="number"
          min={1}
          max={3650}
          value={dias}
          onChange={(e) => setDias(e.target.value)}
          placeholder="Dejalo vacío para no cambiar"
        />
        <Campo
          label={galeria.tienePassword ? "Cambiar contraseña" : "Poner contraseña"}
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Vacío = sin cambios"
          autoComplete="off"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Boton type="submit" disabled={actualizar.isPending}>
          {actualizar.isPending ? "Guardando…" : "Guardar cambios"}
        </Boton>
        {galeria.tienePassword && (
          <Boton
            type="button"
            variante="fantasma"
            onClick={() =>
              actualizar.mutate({ id: galeria.id, quitarPassword: true })
            }
            disabled={actualizar.isPending}
          >
            Quitar contraseña
          </Boton>
        )}
      </div>
    </form>
  );
}
