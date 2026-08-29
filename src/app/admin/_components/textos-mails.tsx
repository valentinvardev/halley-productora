"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Desplegable } from "~/app/_components/desplegable";
import { IconoVolver } from "~/app/_components/iconos";
import {
  Boton,
  BotonTexto,
  Campo,
  CampoTexto,
  Encabezado,
  Etiqueta,
} from "~/app/_components/ui";
import { api, type RouterOutputs } from "~/trpc/react";

/**
 * Los textos de los mails, editables sin deploy.
 *
 * Es el mismo argumento que el del catálogo del simulador: un precio no es una
 * decisión de programación y un texto que le habla a una familia tampoco. Se
 * reescribe cuando aparece una forma mejor de decirlo, y si cada cambio pide un
 * deploy, se deja de hacer.
 *
 * Se editan las palabras y no el HTML. El armado del mail —el logo, el recuadro
 * del monto, el botón— sigue siendo código, y los números entran por variables
 * que pone el sistema, así que un texto editado no puede contradecir a la
 * cuenta. Ésa es la línea: acá se cambia cómo se dice, no cuánto es.
 *
 * Cada mail se guarda solo y por separado. Un botón de "guardar todo" abajo de
 * seis formularios obliga a acordarse de apretarlo y castiga con perder seis
 * ediciones cuando no se lo aprieta.
 */

type Plantilla = RouterOutputs["notificacion"]["plantillas"][number];

export function TextosMails() {
  const lista = api.notificacion.plantillas.useQuery();
  const [elegida, setElegida] = useState<string | null>(null);

  const plantillas = lista.data ?? [];
  const actual = plantillas.find((p) => p.id === elegida) ?? plantillas[0];

  return (
    <>
      <div className="mb-6">
        <Link
          href="/admin/notificaciones"
          className="inline-flex items-center gap-2 font-rotulo text-[11.5px] tracking-[0.08em] text-gray-45 uppercase hover:text-ink"
        >
          <IconoVolver className="h-3 w-3" />
          Bandeja
        </Link>
      </div>

      <Encabezado
        eyebrow="Notificaciones"
        titulo="Textos de los mails"
        bajada="Lo que dice cada mail que sale del sistema. Se guarda al instante y sale sin esperar un deploy. Los montos, las fechas y los números de cuota los pone el sistema: acá se cambia cómo se dice, no cuánto es."
      />

      {lista.isPending ? (
        <p className="nota mt-8">Cargando…</p>
      ) : (
        <>
          {/* Uno a la vez. Los seis apilados eran una pared de veinticuatro
              campos donde no se sabía dónde terminaba uno y empezaba el otro, y
              obligaba a scrollear para encontrar el que se venía a cambiar.

              El desplegable marca cuáles están editados, así que además se ve
              de un vistazo qué se tocó — que apilados también se perdía. */}
          <div className="mt-8 max-w-[420px]">
            <Desplegable
              label="Qué mail estás editando"
              valor={actual?.id ?? null}
              alCambiar={setElegida}
              opciones={plantillas.map((p) => ({
                valor: p.id,
                etiqueta: p.nombre,
                nota: p.editada ? "editado" : undefined,
              }))}
            />
          </div>

          {/* Se pintan las seis y se esconden las que no están elegidas, en vez
              de montar sólo una. Así cambiar de mail para mirar otro no borra lo
              que estabas escribiendo en el primero: el borrador sigue ahí
              cuando volvés. Son seis formularios chicos, no cuesta nada. */}
          <div className="mt-8">
            {plantillas.map((p) => (
              <div key={p.id} hidden={p.id !== actual?.id}>
                <Ficha plantilla={p} alGuardar={() => lista.refetch()} />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Ficha({
  plantilla,
  alGuardar,
}: {
  plantilla: Plantilla;
  alGuardar: () => void;
}) {
  const [asunto, setAsunto] = useState(plantilla.textos.asunto);
  const [titulo, setTitulo] = useState(plantilla.textos.titulo);
  const [parrafo, setParrafo] = useState(plantilla.textos.parrafo);
  const [nota, setNota] = useState(plantilla.textos.nota);

  /**
   * Lo que llega del servidor manda, pero sólo cuando de verdad cambió.
   *
   * Sin esto, restaurar dejaba los campos con el texto viejo: la consulta volvía
   * con el de fábrica y el formulario seguía mostrando lo editado, porque el
   * estado se había inicializado una sola vez.
   *
   * Las dependencias son los cuatro textos y no el objeto que los contiene. El
   * objeto cambia de identidad en cada refetch, así que con él acá guardar una
   * plantilla le borraba el borrador a las otras cinco — que están montadas
   * justamente para no perderlo. Comparando los valores, esto sólo corre cuando
   * el texto guardado cambió, que es cuando corresponde pisar lo escrito.
   */
  const { asunto: gAsunto, titulo: gTitulo, parrafo: gParrafo, nota: gNota } =
    plantilla.textos;
  useEffect(() => {
    setAsunto(gAsunto);
    setTitulo(gTitulo);
    setParrafo(gParrafo);
    setNota(gNota);
  }, [gAsunto, gTitulo, gParrafo, gNota]);

  const guardar = api.notificacion.guardarPlantilla.useMutation({
    onSuccess: alGuardar,
  });
  const restaurar = api.notificacion.restaurarPlantilla.useMutation({
    onSuccess: alGuardar,
  });

  const sucio =
    asunto !== plantilla.textos.asunto ||
    titulo !== plantilla.textos.titulo ||
    parrafo !== plantilla.textos.parrafo ||
    nota !== plantilla.textos.nota;

  const trabajando = guardar.isPending || restaurar.isPending;

  return (
    <section className="border border-ink bg-paper p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex flex-wrap items-center gap-2.5 font-rotulo text-[13px] tracking-[0.08em] uppercase">
            {plantilla.nombre}
            {plantilla.editada && (
              <span className="border border-gray-45 px-1.5 py-px font-rotulo text-[9.5px] tracking-[0.1em] text-gray-45 uppercase">
                Editado
              </span>
            )}
          </h3>
          <p className="nota mt-1">{plantilla.cuando}</p>
        </div>

        {plantilla.editada && (
          <BotonTexto
            onClick={() => restaurar.mutate({ id: plantilla.id })}
            disabled={trabajando}
          >
            Volver al original
          </BotonTexto>
        )}
      </div>

      {plantilla.variables.length > 0 && (
        <div className="mt-5">
          <Etiqueta>Variables</Etiqueta>
          {/* Se listan y no se explican una por una: el nombre ya dice qué
              trae, y lo que importa es que se vea que existen. */}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {plantilla.variables.map((v) => (
              <code
                key={v}
                className="border border-gray-20 bg-paper-dim px-1.5 py-0.5 font-mono text-[11.5px]"
              >
                {`{${v}}`}
              </code>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4">
        <Campo
          label="Asunto"
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
          hint="Lo que se lee en la bandeja antes de abrir."
        />
        <Campo
          label="Título"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          hint="El encabezado grande, adentro del mail."
        />
        <CampoTexto
          label="Cuerpo"
          rows={3}
          value={parrafo}
          onChange={(e) => setParrafo(e.target.value)}
          hint="El párrafo principal."
        />
        <CampoTexto
          label="Nota al pie"
          rows={2}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          hint="La letra chica. Vacío la saca."
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Boton
          onClick={() =>
            guardar.mutate({ id: plantilla.id, asunto, titulo, parrafo, nota })
          }
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
