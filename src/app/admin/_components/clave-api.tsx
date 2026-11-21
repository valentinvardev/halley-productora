"use client";

import { useState } from "react";

import { Copiar } from "~/app/_components/copiar";
import { IconoAlerta, IconoPapelera } from "~/app/_components/iconos";
import { Boton, BotonTexto, Vacio } from "~/app/_components/ui";
import { fecha, fechaHora } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * La clave con la que el bot de WhatsApp da de alta alumnos.
 *
 * Vive en Ajustes y no en un archivo del servidor para que se pueda cambiar
 * sin deploy: si se filtra, se genera otra y la vieja deja de andar en el
 * momento. Por eso generar y revocar piden un segundo clic, y por eso la clave
 * se muestra una sola vez: lo que queda en la base es su huella.
 */
export function ClaveApi() {
  const utils = api.useUtils();
  const estado = api.apiExterna.estado.useQuery();
  /** La clave recién generada. Vive sólo en esta pantalla, hasta salir de ella. */
  const [nueva, setNueva] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<"generar" | "revocar" | null>(
    null,
  );

  const generar = api.apiExterna.generar.useMutation({
    onSuccess: (r) => {
      setNueva(r.clave);
      setConfirmando(null);
      void utils.apiExterna.estado.invalidate();
    },
  });
  const revocar = api.apiExterna.revocar.useMutation({
    onSuccess: () => {
      setNueva(null);
      setConfirmando(null);
      void utils.apiExterna.estado.invalidate();
    },
  });

  if (!estado.data && !estado.isError) return null;

  const clave = estado.data?.clave ?? null;

  return (
    <div className="mt-8 max-w-[560px] border border-ink p-6">
      <div className="eyebrow mb-2.5">Conexión para bots</div>
      <p className="nota mb-4">
        La clave con la que un bot, como el de WhatsApp, da de alta alumnos en
        un curso y les manda la invitación por correo. Es lo mismo que el botón
        Agregar alumno. Hay una sola clave: generar otra corta la anterior en el
        momento.
      </p>

      {estado.isError ? (
        <p className="nota text-marca">
          No se pudo cargar el estado de la clave: {estado.error.message}
        </p>
      ) : !clave ? (
        <Vacio>No hay clave. La API no acepta pedidos.</Vacio>
      ) : (
        <div className="border border-gray-20 px-3.5 py-2.5">
          <div className="font-mono text-[12px]">hly_····{clave.fin}</div>
          <div className="text-[11.5px] text-gray-45">
            {clave.creadaEl ? `creada el ${fecha(clave.creadaEl)} · ` : ""}
            {clave.usadaEl
              ? `usada por última vez el ${fechaHora(clave.usadaEl)}`
              : "todavía no se usó"}
          </div>
        </div>
      )}

      {nueva && (
        <div className="mt-4 border border-marca p-4">
          <div className="flex items-center gap-2 font-rotulo text-[12px] tracking-[0.06em] text-marca uppercase">
            <IconoAlerta />
            Copiala ahora
          </div>
          <p className="nota mt-1.5">
            No se vuelve a mostrar. Pasásela a quien configura el bot por un
            canal privado: con ella se puede dar de alta alumnos.
          </p>
          <div className="mt-3 font-mono text-[12px] break-all select-all">
            {nueva}
          </div>
          <Copiar valor={nueva} etiqueta="Copiar la clave" className="mt-2" />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Boton
          variante={clave ? "fantasma" : undefined}
          disabled={generar.isPending}
          onClick={() => {
            if (!clave || confirmando === "generar") generar.mutate();
            else setConfirmando("generar");
          }}
        >
          {generar.isPending
            ? "Generando…"
            : !clave
              ? "Generar clave"
              : confirmando === "generar"
                ? "¿Seguro? La actual deja de andar"
                : "Generar otra"}
        </Boton>
        {clave && (
          <BotonTexto
            className="text-gray-45"
            disabled={revocar.isPending}
            onClick={() => {
              if (confirmando === "revocar") revocar.mutate();
              else setConfirmando("revocar");
            }}
          >
            <IconoPapelera />
            {confirmando === "revocar"
              ? "¿Seguro? El bot deja de poder dar altas"
              : "Revocar"}
          </BotonTexto>
        )}
      </div>
      {(generar.isError || revocar.isError) && (
        <p className="nota mt-2 text-marca">
          {(generar.error ?? revocar.error)?.message}
        </p>
      )}

      <p className="nota mt-4 text-[11.5px]">
        Entra sólo a los cursos de egresados con el registro abierto, frena los
        nombres repetidos y los emails mal escritos, y da hasta{" "}
        {estado.data?.altasPorHora ?? 60} altas nuevas por hora. Cómo
        conectarlo: docs/api.md, en el repositorio.
      </p>
    </div>
  );
}
