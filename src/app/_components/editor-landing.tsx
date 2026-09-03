"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api, type RouterOutputs } from "~/trpc/react";

/**
 * Editar los textos de la página tocándolos en la página.
 *
 * El panel tiene una pantalla que lista las secciones y sus campos, y sirve para
 * repasar todo junto. Pero el caso real no es ése: es "esta frase no me gusta",
 * mirando la frase. Ahí, elegir la sección en un desplegable obliga a traducir lo
 * que se está viendo al nombre que alguien le puso en un catálogo, y esa
 * traducción es justo la parte que uno no quiere hacer.
 *
 * Acá se toca el texto y aparece su campo. Lo que hace posible que sea tan poco
 * código es que el almacenamiento ya estaba resuelto: cada texto editable ya era
 * un campo con nombre. Esto sólo agrega cómo encontrarlo.
 *
 * Vive sobre la página de verdad y no sobre una copia adentro del panel. Editar
 * mirando una vista previa reintroduce la duda que la vista previa venía a sacar,
 * que es si lo que se ve es lo que va a quedar.
 *
 * No se enciende solo. Un administrador que entra a mirar el sitio lo ve como
 * cualquiera; el modo edición se pide con `?editar=1`, y del panel sale un link
 * que ya lo trae puesto. Sin eso, quien administra no podría ver nunca su propia
 * web como la ve un cliente.
 */

/** Lo que la página marcó como editable: "bloque.campo". */
type Elegido = { bloque: string; campo: string };

function leerDestino(el: Element | null): Elegido | null {
  const marca = el?.closest("[data-texto]")?.getAttribute("data-texto");
  const [bloque, campo] = (marca ?? "").split(".");
  return bloque && campo ? { bloque, campo } : null;
}

export function EditorLanding() {
  const router = useRouter();
  // El editor ya no vive sólo en la portada: salir vuelve a la página en la
  // que se estaba, sin el `?editar=1`.
  const ruta = usePathname();
  const [elegido, setElegido] = useState<Elegido | null>(null);

  const lista = api.ajuste.textos.useQuery();

  /**
   * La clase prende el punteado que muestra qué se puede tocar.
   *
   * Va en el `body` y no en un contenedor propio porque los textos editables
   * están repartidos por toda la página, y el estilo tiene que alcanzarlos a
   * todos sin que este componente sea su padre.
   */
  useEffect(() => {
    document.body.classList.add("editando");
    return () => document.body.classList.remove("editando");
  }, []);

  useEffect(() => {
    const alTocar = (e: MouseEvent) => {
      const destino = leerDestino(e.target as Element | null);
      if (!destino) return;

      // Un titular editable puede estar adentro de un link. En modo edición
      // gana la edición: para navegar está el sitio sin `?editar=1`.
      e.preventDefault();
      e.stopPropagation();
      setElegido(destino);
    };

    document.addEventListener("click", alTocar, true);
    return () => document.removeEventListener("click", alTocar, true);
  }, []);

  const bloque = lista.data?.find((b) => b.id === elegido?.bloque);
  const campo = bloque?.campos.find((c) => c.nombre === elegido?.campo);

  return (
    <>
      {/* Barra fija que dice en qué modo se está. Sin esto, alguien que llega
          por el link y se olvida no entiende por qué la página tiene punteados
          y no responde a los clics. */}
      <div
        data-editor
        className="fixed top-0 right-0 left-0 z-[60] flex flex-wrap items-center justify-between gap-3 border-b border-ink bg-ink px-4 py-2
 text-paper"
      >
        <span className="font-rotulo text-[11.5px] tracking-[0.1em] uppercase">
          Modo edición · tocá un texto para cambiarlo
        </span>
        <a
          href={ruta}
          className="font-rotulo text-[11px] tracking-[0.06em] text-paper/70 uppercase underline underline-offset-4 hover:text-paper"
        >
          Salir
        </a>
      </div>

      {elegido && bloque && campo && (
        <Panel
          key={`${elegido.bloque}.${elegido.campo}`}
          bloque={bloque}
          campo={campo}
          alCerrar={() => setElegido(null)}
          alElegirCampo={(nombre) =>
            setElegido({ bloque: elegido.bloque, campo: nombre })
          }
          alGuardar={() => {
            // El texto lo pinta el servidor, así que refrescar es lo que hace
            // que el cambio se vea en la página y no sólo en el panel.
            router.refresh();
            void lista.refetch();
          }}
        />
      )}
    </>
  );
}

type Bloque = RouterOutputs["ajuste"]["textos"][number];

function Panel({
  bloque,
  campo,
  alCerrar,
  alGuardar,
  alElegirCampo,
}: {
  bloque: Bloque;
  campo: Bloque["campos"][number];
  alCerrar: () => void;
  alGuardar: () => void;
  alElegirCampo: (nombre: string) => void;
}) {
  const [valor, setValor] = useState(bloque.textos[campo.nombre] ?? "");

  const guardar = api.ajuste.guardarTexto.useMutation({ onSuccess: alGuardar });

  const original = bloque.textos[campo.nombre] ?? "";
  const sucio = valor !== original;
  const otros = bloque.campos.filter((c) => c.nombre !== campo.nombre);

  return (
    <aside
      data-editor
      className="fixed top-0 right-0 bottom-0 z-[70] flex w-[min(380px,100vw)]
 flex-col border-l border-ink bg-paper"
    >
      <div className="flex items-start justify-between gap-3 border-b border-gray-20 px-5 py-4">
        <div>
          <div className="font-rotulo text-[10.5px] tracking-[0.1em] text-gray-45 uppercase">
            {bloque.nombre}
          </div>
          <div className="mt-0.5 font-rotulo text-[13px] tracking-[0.06em] uppercase">
            {campo.etiqueta}
          </div>
        </div>
        <button
          type="button"
          onClick={alCerrar}
          aria-label="Cerrar"
          className="cursor-pointer font-rotulo text-[11px] tracking-[0.06em] text-gray-45 uppercase hover:text-ink"
        >
          Cerrar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <textarea
          autoFocus
          rows={campo.largo ? 8 : 3}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="w-full resize-y border border-ink bg-lienzo px-3 py-2.5 text-[14px] leading-relaxed"
        />

        <p className="nota mt-2 text-[11.5px]">
          Vacío vuelve al texto original.
        </p>

        {/* Los demás textos de la sección.

            No todo lo que se puede editar se puede tocar en la página. El
            mensaje con el que se abre el WhatsApp, por ejemplo, no se ve en
            ningún lado: está adentro del link. Sin esta lista habría campos que
            sólo existen en la pantalla del panel, y el editor sobre la página
            dejaría de ser una puerta completa.

            Se esconde mientras hay cambios sin guardar. Cambiar de campo
            desmonta el que estaba, y perder lo escrito por tocar un link es la
            clase de cosa que hace desconfiar de un editor. */}
        {otros.length > 0 && (
          <div className="mt-5 border-t border-gray-20 pt-4">
            <div className="font-rotulo text-[10.5px] tracking-[0.1em] text-gray-45 uppercase">
              Más de esta sección
            </div>
            {sucio ? (
              <p className="nota mt-1.5 text-[11.5px]">
                Guardá para poder pasar a otro texto.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                {otros.map((c) => (
                  <button
                    key={c.nombre}
                    type="button"
                    onClick={() => alElegirCampo(c.nombre)}
                    className="cursor-pointer font-rotulo text-[11px] tracking-[0.06em] text-gray-45 uppercase underline underline-offset-4 hover:text-ink"
                  >
                    {c.etiqueta}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {valor !== campo.porDefecto && (
          <div className="mt-5 border-t border-gray-20 pt-4">
            <div className="font-rotulo text-[10.5px] tracking-[0.1em] text-gray-45 uppercase">
              Texto original
            </div>
            <p className="nota mt-1.5 text-[12.5px]">{campo.porDefecto}</p>
            <button
              type="button"
              onClick={() => setValor(campo.porDefecto)}
              className="mt-2 cursor-pointer font-rotulo text-[11px] tracking-[0.06em] text-gray-45 uppercase underline underline-offset-4 hover:text-ink"
            >
              Usar el original
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-gray-20 px-5 py-4">
        <button
          type="button"
          disabled={!sucio || guardar.isPending}
          onClick={() =>
            guardar.mutate({
              id: bloque.id,
              // Se manda el bloque entero con este campo cambiado: la mutación
              // guarda por bloque, y mandar sólo uno borraría los otros.
              textos: { ...bloque.textos, [campo.nombre]: valor },
            })
          }
          className="cursor-pointer border border-ink bg-ink px-4 py-2.5 font-rotulo text-[12px] tracking-[0.06em] text-paper uppercase disabled:cursor-default disabled:opacity-40"
        >
          {guardar.isPending ? "Guardando…" : "Guardar"}
        </button>

        {sucio && !guardar.isPending && (
          <span className="nota text-[11.5px]">Sin guardar.</span>
        )}
        {guardar.error && (
          <span className="nota text-[11.5px] text-marca">
            {guardar.error.message}
          </span>
        )}
      </div>
    </aside>
  );
}
