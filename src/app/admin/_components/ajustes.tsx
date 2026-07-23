"use client";

import { useEffect, useState } from "react";

import { IconoTilde } from "~/app/_components/iconos";
import { Boton, Campo, Encabezado } from "~/app/_components/ui";
import { CAMPOS_AJUSTE, type ClaveAjusteUI } from "~/app/_datos/ajustes";
import { api } from "~/trpc/react";
import { EsqueletoAjustes } from "./esqueletos";

/**
 * Los datos de contacto que salen en la web.
 *
 * El WhatsApp es el que más se toca: de ahí salen todos los botones de "pedir
 * presupuesto" del sitio. Antes estaba escrito en el código y cambiarlo pedía un
 * deploy.
 */
export function Ajustes() {
  const utils = api.useUtils();
  const { data, isLoading } = api.ajuste.obtener.useQuery();
  const [valores, setValores] = useState<Record<string, string> | null>(null);

  // Los valores guardados llenan el formulario una vez, al llegar.
  useEffect(() => {
    if (data && !valores) setValores({ ...data });
  }, [data, valores]);

  const guardar = api.ajuste.guardar.useMutation({
    onSuccess: (nuevos) => {
      setValores({ ...nuevos });
      void utils.ajuste.obtener.invalidate();
    },
  });

  if (isLoading || !valores) {
    return (
      <>
        <Encabezado
          eyebrow="Panel"
          titulo="Ajustes"
          bajada="Los datos de contacto que aparecen en la web pública."
        />
        <EsqueletoAjustes />
      </>
    );
  }

  const cambio = CAMPOS_AJUSTE.some(
    (c) => (valores[c.clave] ?? "") !== ((data?.[c.clave] as string) ?? ""),
  );

  return (
    <>
      <Encabezado
        eyebrow="Panel"
        titulo="Ajustes"
        bajada="Los datos de contacto que aparecen en la web pública. El WhatsApp alimenta todos los botones de “pedir presupuesto”."
      />

      <div className="max-w-[560px] border border-ink p-6">
        <div className="grid gap-5">
          {CAMPOS_AJUSTE.map((c) => (
            <Campo
              key={c.clave}
              label={c.etiqueta}
              type={c.tipo}
              hint={c.ayuda}
              value={valores[c.clave] ?? ""}
              onChange={(e) =>
                setValores((v) => ({ ...v!, [c.clave]: e.target.value }))
              }
            />
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Boton
            onClick={() =>
              guardar.mutate(
                Object.fromEntries(
                  CAMPOS_AJUSTE.map((c) => [
                    c.clave,
                    valores[c.clave] ?? "",
                  ]),
                ) as Record<ClaveAjusteUI, string>,
              )
            }
            disabled={!cambio || guardar.isPending}
          >
            {guardar.isPending ? "Guardando…" : "Guardar"}
          </Boton>

          {guardar.isSuccess && !cambio && (
            <span className="inline-flex items-center gap-1.5 font-rotulo text-[11.5px] uppercase tracking-[0.06em] text-gray-45">
              <IconoTilde className="h-3.5 w-3.5" />
              Guardado
            </span>
          )}
          {guardar.isError && (
            <span className="nota text-marca">{guardar.error.message}</span>
          )}
        </div>
      </div>

      <p className="nota mt-4 max-w-[62ch]">
        Los cambios se ven en la web enseguida: las páginas públicas leen esto en
        cada visita.
      </p>
    </>
  );
}
