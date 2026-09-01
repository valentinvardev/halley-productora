"use client";

import { useEffect, useState } from "react";

import { Desplegable } from "~/app/_components/desplegable";
import {
  Boton,
  BotonTexto,
  Campo,
  CampoTexto,
  Encabezado,
} from "~/app/_components/ui";
import { api, type RouterOutputs } from "~/trpc/react";

/**
 * Los textos de la web, editables sin deploy.
 *
 * Mismo criterio que el editor de los mails, y a propósito: se editan las
 * palabras, no la maqueta. Lo que se guarda son campos con nombre que la página
 * lee y acomoda; no hay HTML ni estructura libre, así que desde acá no se puede
 * romper el diseño.
 *
 * Un bloque a la vez, con un desplegable arriba. Apilados serían una pared de
 * campos donde no se ve dónde termina uno y empieza el otro, y hay que
 * scrollear para encontrar el que se venía a cambiar.
 */

type Bloque = RouterOutputs["ajuste"]["textos"][number];

export function TextosSitio() {
  const lista = api.ajuste.textos.useQuery();
  const [elegido, setElegido] = useState<string | null>(null);

  const bloques = lista.data ?? [];
  const actual = bloques.find((b) => b.id === elegido) ?? bloques[0];

  return (
    <>
      <Encabezado
        eyebrow="Panel"
        titulo="Textos de la web"
        bajada="Lo que dicen las secciones de la portada. Se guarda al instante y sale sin esperar un deploy. Lo que se edita son las palabras: el diseño, el orden y los botones siguen siendo del sitio."
      />

      {/* La otra puerta a lo mismo.

          Esta pantalla sirve para repasar todo junto y para encontrar un texto
          cuando no se sabe bien en qué parte de la página estaba. Pero cuando lo
          que hay es una frase puntual que no gusta, lo natural es ir a la página,
          tocarla y escribirla ahí. El link lleva a la portada con el modo
          prendido; sin `?editar=1` la portada se ve como la ve cualquiera. */}
      <a
        href="/?editar=1"
        className="mt-6 inline-flex items-center gap-2 border border-ink px-4 py-2.5 font-rotulo text-[12px] tracking-[0.06em] uppercase hover:bg-ink hover:text-paper"
      >
        Editar sobre la página
      </a>

      {lista.isPending ? (
        <p className="nota mt-8">Cargando…</p>
      ) : (
        <>
          <div className="mt-8 max-w-[420px]">
            <Desplegable
              label="Qué sección estás editando"
              valor={actual?.id ?? null}
              alCambiar={setElegido}
              opciones={bloques.map((b) => ({
                valor: b.id,
                etiqueta: b.nombre,
                nota: b.editado ? "editado" : undefined,
              }))}
            />
          </div>

          {/* Se pintan todos y se esconden los que no están elegidos. Así
              cambiar de sección para mirar otra no borra lo que estabas
              escribiendo en la primera. */}
          <div className="mt-8">
            {bloques.map((b) => (
              <div key={b.id} hidden={b.id !== actual?.id}>
                <Ficha bloque={b} alGuardar={() => lista.refetch()} />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Ficha({
  bloque,
  alGuardar,
}: {
  bloque: Bloque;
  alGuardar: () => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>(() => ({
    ...bloque.textos,
  }));

  /**
   * Lo guardado manda, pero sólo cuando de verdad cambió.
   *
   * La comparación es sobre el contenido y no sobre la identidad del objeto: ése
   * cambia en cada refetch, y con él acá guardar una sección le borraría el
   * borrador a las otras, que están montadas justamente para no perderlo.
   */
  const firma = JSON.stringify(bloque.textos);
  useEffect(() => {
    setValores({ ...(JSON.parse(firma) as Record<string, string>) });
  }, [firma]);

  const guardar = api.ajuste.guardarTexto.useMutation({ onSuccess: alGuardar });
  const restaurar = api.ajuste.restaurarTexto.useMutation({
    onSuccess: alGuardar,
  });

  const sucio = bloque.campos.some(
    (c) => (valores[c.nombre] ?? "") !== bloque.textos[c.nombre],
  );
  const trabajando = guardar.isPending || restaurar.isPending;

  return (
    <section className="border border-ink bg-paper p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex flex-wrap items-center gap-2.5 font-rotulo text-[13px] tracking-[0.08em] uppercase">
            {bloque.nombre}
            {bloque.editado && (
              <span className="border border-gray-45 px-1.5 py-px font-rotulo text-[9.5px] tracking-[0.1em] text-gray-45 uppercase">
                Editado
              </span>
            )}
          </h3>
          <p className="nota mt-1 max-w-[68ch]">{bloque.donde}</p>
        </div>

        {bloque.editado && (
          <BotonTexto
            onClick={() => restaurar.mutate({ id: bloque.id })}
            disabled={trabajando}
          >
            Volver al original
          </BotonTexto>
        )}
      </div>

      <div className="mt-5 grid gap-4">
        {bloque.campos.map((c) => {
          const comun = {
            label: c.etiqueta,
            value: valores[c.nombre] ?? "",
            onChange: (
              e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
            ) => setValores((v) => ({ ...v, [c.nombre]: e.target.value })),
            // Vaciar un campo lo devuelve al texto de fábrica, así que conviene
            // decirlo donde se lo está vaciando y no en la ayuda de la pantalla.
            hint: "Vacío vuelve al texto original.",
          };
          return c.largo ? (
            <CampoTexto key={c.nombre} rows={3} {...comun} />
          ) : (
            <Campo key={c.nombre} {...comun} />
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Boton
          onClick={() => guardar.mutate({ id: bloque.id, textos: valores })}
          disabled={!sucio || trabajando}
        >
          {guardar.isPending ? "Guardando…" : "Guardar"}
        </Boton>

        {sucio && !trabajando && (
          <span className="nota">Hay cambios sin guardar.</span>
        )}
        {guardar.error && (
          <span className="nota text-marca">{guardar.error.message}</span>
        )}
      </div>
    </section>
  );
}
