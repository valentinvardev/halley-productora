"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  IconoCampana,
  IconoMas,
  IconoPapelera,
  IconoTilde,
} from "~/app/_components/iconos";
import { Boton, BotonTexto, Campo, Encabezado } from "~/app/_components/ui";
import {
  CAMPOS_AJUSTE,
  SONIDOS_PAGO,
  SONIDO_PROPIO,
  type ClaveAjusteUI,
} from "~/app/_datos/ajustes";
import { Desplegable } from "~/app/_components/desplegable";
import { api } from "~/trpc/react";
import { probarAvisoCobro } from "./aviso-cobros";
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
  const router = useRouter();
  const { data, isLoading } = api.ajuste.obtener.useQuery();
  const [valores, setValores] = useState<Record<string, string> | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorSonido, setErrorSonido] = useState<string | null>(null);

  // Los valores guardados llenan el formulario una vez, al llegar.
  useEffect(() => {
    if (data && !valores) setValores({ ...data });
  }, [data, valores]);

  /**
   * Después de guardar se refresca el layout. El cartel de cobro vive ahí y
   * recibe el sonido como prop del servidor: sin esto, seguía sonando el de
   * antes hasta cambiar de pantalla.
   */
  const alGuardar = (nuevos: Record<string, string>) => {
    setValores({ ...nuevos });
    void utils.ajuste.obtener.invalidate();
    router.refresh();
  };
  const guardar = api.ajuste.guardar.useMutation({ onSuccess: alGuardar });
  const firmarSonido = api.ajuste.urlDeSubidaSonido.useMutation();
  const guardarSonido = api.ajuste.guardarSonido.useMutation({
    onSuccess: alGuardar,
  });
  const quitarSonido = api.ajuste.quitarSonido.useMutation({
    onSuccess: alGuardar,
  });

  /**
   * Subir el sonido propio: firmar, PUT directo a S3, guardar la key.
   *
   * Se acota a dos megas. Un aviso dura un par de segundos; un archivo más
   * grande es casi seguro una canción entera, y sonaría entera cada vez que
   * entra un pago.
   */
  async function subirSonido(archivo: File) {
    setErrorSonido(null);
    const tipo = archivo.type as Parameters<
      typeof firmarSonido.mutateAsync
    >[0]["contentType"];
    const admitidos = [
      "audio/mpeg",
      "audio/mp4",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
      "audio/webm",
    ];
    if (!admitidos.includes(tipo)) {
      setErrorSonido("Subí un MP3, WAV, OGG o M4A.");
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      setErrorSonido(
        "Tiene que pesar menos de 2 MB: es un aviso, no una canción.",
      );
      return;
    }
    setSubiendo(true);
    try {
      const { url, key } = await firmarSonido.mutateAsync({
        contentType: tipo,
      });
      const r = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": tipo },
        body: archivo,
      });
      if (!r.ok) throw new Error(`S3 respondió ${r.status}`);
      const nuevos = await guardarSonido.mutateAsync({ key });
      // Y se escucha enseguida, con el archivo recién subido.
      probarAvisoCobro({
        sonido: "personalizado",
        sonidoKey: nuevos.sonidoPagoKey,
      });
    } catch (e) {
      setErrorSonido(
        e instanceof Error ? e.message : "No se pudo subir el sonido.",
      );
    } finally {
      setSubiendo(false);
    }
  }

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
  const sonidoKey = valores.sonidoPagoKey ?? "";
  // "Sonido propio" entra a la lista sólo si hay uno subido.
  const opcionesSonido = [
    ...SONIDOS_PAGO.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta })),
    ...(sonidoKey ? [SONIDO_PROPIO] : []),
  ];

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
            <div className="flex flex-wrap items-end gap-3">
              <Desplegable
                label="Sonido al cobrar"
                className="min-w-[180px] flex-1"
                valor={sonido}
                alCambiar={(v) => setValores((x) => ({ ...x!, sonidoPago: v }))}
                opciones={opcionesSonido}
              />
              {/* Ya no está deshabilitado en "silencio": probar ahora también
                  muestra el cartel, y ver dónde aparece y qué dice es la mitad
                  de lo que uno quiere saber antes de dejarlo andando. */}
              {/* Prueba lo que está elegido en este momento, aunque no se haya
                  guardado. Es lo que uno espera al tocar "probar" después de
                  cambiar el desplegable. */}
              <Boton
                variante="fantasma"
                onClick={() => probarAvisoCobro({ sonido, sonidoKey })}
              >
                <IconoCampana />
                Probar
              </Boton>
            </div>
            <p className="nota mt-1.5">
              Suena en el panel cuando entra un pago, en la pantalla que sea.
              Probar muestra el aviso de verdad, arriba a la derecha.
            </p>

            {/* El sonido propio: se sube, queda elegido y se puede quitar. Va
                debajo del desplegable porque es una de sus opciones, sólo que
                hay que traerla. */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <input
                ref={archivoRef}
                type="file"
                accept="audio/mpeg,audio/mp4,audio/wav,audio/x-wav,audio/ogg,audio/webm,.mp3,.m4a,.wav,.ogg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void subirSonido(f);
                  e.target.value = "";
                }}
              />
              <BotonTexto
                onClick={() => archivoRef.current?.click()}
                disabled={subiendo}
              >
                <IconoMas />
                {subiendo
                  ? "Subiendo…"
                  : sonidoKey
                    ? "Cambiar el sonido propio"
                    : "Subir un sonido propio"}
              </BotonTexto>
              {sonidoKey && (
                <BotonTexto
                  onClick={() => quitarSonido.mutate()}
                  disabled={quitarSonido.isPending}
                  className="text-gray-45"
                >
                  <IconoPapelera />
                  Quitar
                </BotonTexto>
              )}
              {errorSonido && (
                <span className="nota text-[12px] text-marca">
                  {errorSonido}
                </span>
              )}
            </div>
            <p className="nota mt-1.5 text-[11.5px]">
              MP3, WAV, OGG o M4A de hasta 2 MB. Al subirlo queda elegido y se
              escucha una vez.
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
