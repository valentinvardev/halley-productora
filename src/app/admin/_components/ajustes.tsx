"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  IconoCampana,
  IconoMas,
  IconoPapelera,
  IconoTilde,
} from "~/app/_components/iconos";
import {
  Boton,
  BotonTexto,
  Campo,
  Encabezado,
  Etiqueta,
  Vacio,
} from "~/app/_components/ui";
import {
  CAMPOS_AJUSTE,
  SONIDOS_PAGO,
  SONIDO_PROPIO,
  type ClaveAjusteUI,
} from "~/app/_datos/ajustes";
import { Desplegable } from "~/app/_components/desplegable";
import { fecha, fechaHora } from "~/lib/format";
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

  // Las puertas abiertas sin link. Es la lista de auditoría: acá se ve todo
  // lo habilitado y se quita, pero no se habilita, porque una fila sin
  // familia abriría un panel vacío. Eso se hace desde la ficha del alumno.
  const sinEnlace = api.accesoSinEnlace.listar.useQuery();
  /** Qué Quitar está esperando el segundo clic. */
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [avisoSinEnlace, setAvisoSinEnlace] = useState<string | null>(null);
  const quitarSinEnlace = api.accesoSinEnlace.quitar.useMutation({
    onSuccess: (r, v) => {
      setAvisoSinEnlace(
        r.sesionesCerradas === 0
          ? `${v.email} vuelve a entrar por correo. No había sesiones abiertas sin link.`
          : r.sesionesCerradas === 1
            ? `${v.email} vuelve a entrar por correo. Se cerró 1 sesión abierta sin link.`
            : `${v.email} vuelve a entrar por correo. Se cerraron ${r.sesionesCerradas} sesiones abiertas sin link.`,
      );
      void utils.accesoSinEnlace.listar.invalidate();
    },
    onError: (e) => setAvisoSinEnlace(e.message),
  });

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

      {/* Mientras carga no se muestra nada: el bloque aparece con la lista. Si
          la lista falla, el bloque aparece igual y lo dice: un Ajustes que se
          ve completo sin este bloque esconde puertas abiertas. */}
      {(sinEnlace.data || sinEnlace.isError) && (
        <div className="mt-8 max-w-[560px] border border-ink p-6">
          <div className="eyebrow mb-2.5">Entran sin link</div>
          <p className="nota mb-4">
            Las familias y los cursos a los que les abriste la puerta con sólo
            el email. Cualquiera que escriba uno de esos emails entra al panel
            de esa familia. Una familia se habilita desde la ficha del alumno,
            en Acciones; un curso entero, desde su página.
          </p>

          {!sinEnlace.data ? (
            <p className="nota text-marca">
              No se pudo cargar la lista: {sinEnlace.error?.message}
            </p>
          ) : sinEnlace.data.familias.length === 0 &&
            sinEnlace.data.cursos.length === 0 ? (
            <Vacio>Nadie entra sin link.</Vacio>
          ) : (
            <>
              {/* Los cursos enteros primero: una fila acá son sesenta
                  familias, y es lo que hay que ver de un vistazo. */}
              {sinEnlace.data.cursos.length > 0 && (
                <div className="mb-4">
                  <Etiqueta>Cursos enteros</Etiqueta>
                  <div className="mt-1.5 border border-gray-20">
                    {sinEnlace.data.cursos.map((c) => (
                      <Link
                        key={c.id}
                        href={`/admin/grupos/${c.id}`}
                        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-gray-20 px-3.5 py-2.5 last:border-b-0 hover:bg-paper-dim"
                      >
                        <span className="min-w-0">
                          <span className="text-[13px]">{c.nombre}</span>
                          <span className="block text-[11.5px] text-gray-45">
                            {c.colegio} · {c.alumnos}{" "}
                            {c.alumnos === 1 ? "alumno" : "alumnos"}
                          </span>
                        </span>
                        <span className="font-rotulo text-[11px] tracking-[0.05em] text-gray-45 uppercase underline underline-offset-2">
                          Se apaga desde el curso
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {sinEnlace.data.familias.length > 0 && (
                <div className="border border-gray-20">
                  {sinEnlace.data.familias.map((f) => (
                    <div
                      key={f.email}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-gray-20 px-3.5 py-2.5 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-[11.5px] break-all">
                          {f.email}
                        </div>
                        {/* Una fila sin alumnos es la cuenta a la que le sacaron
                        o borraron a todos: la regla de entrada ya la deja
                        inerte, pero se muestra para que se pueda quitar. */}
                        <div className="text-[11.5px] text-gray-45">
                          {f.alumnos.length > 0
                            ? f.alumnos
                                .map((a) => `${a.nombre}, ${a.grupo}`)
                                .join(" · ")
                            : "ya no es responsable de ningún alumno"}
                        </div>
                        <div className="text-[11.5px] text-gray-45">
                          desde el {fecha(f.desde)} ·{" "}
                          {f.usos === 0 || !f.ultimoUsoEl
                            ? "todavía no entró"
                            : `entró ${f.usos} ${f.usos === 1 ? "vez" : "veces"}, la última el ${fechaHora(f.ultimoUsoEl)}`}
                        </div>
                      </div>
                      <BotonTexto
                        onClick={() => {
                          if (confirmando === f.email) {
                            setConfirmando(null);
                            quitarSinEnlace.mutate({ email: f.email });
                          } else {
                            setConfirmando(f.email);
                          }
                        }}
                        disabled={quitarSinEnlace.isPending}
                        className="text-gray-45"
                      >
                        {confirmando === f.email
                          ? "¿Seguro? Vuelve al correo"
                          : "Quitar"}
                      </BotonTexto>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {avisoSinEnlace && (
            <p className="nota mt-3 text-[12px]">{avisoSinEnlace}</p>
          )}
        </div>
      )}

      <p className="nota mt-4 max-w-[62ch]">
        Los cambios se ven en la web enseguida: las páginas públicas leen esto
        en cada visita.
      </p>
    </>
  );
}
