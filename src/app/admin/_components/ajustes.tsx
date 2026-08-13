"use client";

import { useEffect, useState } from "react";

import { IconoTilde } from "~/app/_components/iconos";
import { Boton, Campo, Encabezado } from "~/app/_components/ui";
import {
  CAMPOS_AJUSTE,
  SONIDOS_PAGO,
  type ClaveAjusteUI,
} from "~/app/_datos/ajustes";
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

  const CLAVES = [...CAMPOS_AJUSTE.map((c) => c.clave), "sonidoPago"] as const;
  const cambio = CLAVES.some(
    (clave) => (valores[clave] ?? "") !== ((data?.[clave] as string) ?? ""),
  );

  const sonido = valores.sonidoPago ?? "campana";

  return (
    <>
      <Encabezado
        eyebrow="Panel"
        titulo="Ajustes"
        bajada="Los datos de contacto que aparecen en la web pública, y el sonido con el que el panel avisa que entró un pago."
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
          {/* El sonido del aviso de cobro. Va con el resto de lo que se cambia
                sin deploy, y con un botón para escucharlo: elegir un sonido a
                ciegas por su nombre no sirve de nada. */}
          <div>
            <label className="mb-1.5 block font-rotulo text-[11.5px] tracking-[0.08em] text-gray-70 uppercase">
              Sonido al cobrar
            </label>
            <div className="flex flex-wrap gap-3">
              <select
                value={sonido}
                onChange={(e) =>
                  setValores((v) => ({ ...v!, sonidoPago: e.target.value }))
                }
                className="min-w-[180px] flex-1 border border-ink bg-lienzo px-3 py-2.5 text-[14px] text-ink"
              >
                {SONIDOS_PAGO.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
              <Boton
                variante="fantasma"
                onClick={() => {
                  if (sonido === "silencio") return;
                  void new Audio(`/sonidos/${sonido}.mp3`)
                    .play()
                    .catch(() => undefined);
                }}
                disabled={sonido === "silencio"}
              >
                Probar
              </Boton>
            </div>
            <p className="nota mt-1.5">
              Suena en el panel cuando entra un pago, en la pantalla que sea.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Boton
            onClick={() =>
              guardar.mutate(
                Object.fromEntries(
                  CLAVES.map((clave) => [clave, valores[clave] ?? ""]),
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
        Los cambios se ven en la web enseguida: las páginas públicas leen esto
        en cada visita.
      </p>
    </>
  );
}
