"use client";

import { IconoAlerta } from "~/app/_components/iconos";
import { Modal } from "~/app/_components/modal";
import { Boton } from "~/app/_components/ui";
import { buscarParecidos, type Parecido } from "~/lib/nombres";

/**
 * El aviso de que un alumno que se está por cargar ya podría estar cargado.
 *
 * Dar de alta es idempotente por nombre exacto, y exacto no alcanza contra
 * listas escritas a mano. "Araceli Merlo" y "Merlo Araceli" entraron las dos en
 * el mismo curso: dos planes de cuotas sobre la misma chica, y a la familia le
 * habrían llegado dos invitaciones y dos recordatorios por cada cuota.
 *
 * Avisa, no impide. En un curso hay hermanos y hay nombres que se repiten, y el
 * que carga la lista sabe cuál es cuál; el sistema no. Un control que bloquea
 * obliga a pelearlo cuando se equivoca, y como se equivoca seguido, se termina
 * buscando cómo saltearlo.
 *
 * Lo que sí hace es decir qué pasa si se sigue de largo, que es lo que no se
 * ve: el costo de un duplicado no lo paga quien lo crea, lo paga la familia que
 * recibe dos veces cada mail y figura debiendo el doble.
 */

export type Coincidencia = {
  /** El nombre tal cual se está por cargar. */
  nuevo: string;
  /** Lo que ya está en el grupo y se le parece. */
  contra: {
    nombre: string;
    emailContacto?: string | null;
    /** Null si la familia todavía no recibió nada. */
    invitadaEl?: Date | string | null;
    parecido: Parecido;
    mismoEmail: boolean;
    /** Cuando el parecido es contra otra línea del mismo pegado. */
    enLaLista?: boolean;
  }[];
};

/** Un alumno ya cargado en el grupo, con lo que hace falta para mostrarlo. */
type YaCargado = {
  id: string;
  nombre: string;
  emailContacto: string | null;
  invitadaEl: Date | string | null;
};

/**
 * Qué de lo que se está por cargar ya podría estar.
 *
 * Mira contra dos cosas: los que ya están en el grupo, y las líneas anteriores
 * del mismo pegado. Lo segundo importa tanto como lo primero, porque una lista
 * armada a mano puede traer al mismo alumno dos veces antes de que el grupo lo
 * tenga ni una. Se compara sólo hacia atrás para que el par salga nombrado una
 * vez y no dos.
 */
export function buscarCoincidencias(
  nuevos: { nombre: string; emailContacto?: string | null }[],
  yaCargados: YaCargado[],
): Coincidencia[] {
  const salida: Coincidencia[] = [];

  nuevos.forEach((fila, i) => {
    const contra: Coincidencia["contra"] = [];

    for (const p of buscarParecidos(fila.nombre, fila.emailContacto, yaCargados)) {
      contra.push({
        nombre: p.alumno.nombre,
        emailContacto: p.alumno.emailContacto,
        invitadaEl: p.alumno.invitadaEl,
        parecido: p.parecido,
        mismoEmail: p.mismoEmail,
      });
    }

    const anteriores = nuevos.slice(0, i).map((f, j) => ({
      id: `fila-${j}`,
      nombre: f.nombre,
      emailContacto: f.emailContacto ?? null,
    }));
    for (const p of buscarParecidos(fila.nombre, fila.emailContacto, anteriores)) {
      contra.push({
        nombre: p.alumno.nombre,
        emailContacto: p.alumno.emailContacto,
        parecido: p.parecido,
        mismoEmail: p.mismoEmail,
        enLaLista: true,
      });
    }

    if (contra.length > 0) salida.push({ nuevo: fila.nombre, contra });
  });

  return salida;
}

export function AvisoDuplicados({
  abierto,
  coincidencias,
  trabajando,
  alCancelar,
  alSeguir,
}: {
  abierto: boolean;
  coincidencias: Coincidencia[];
  /** Mientras se crea, para que no se apriete dos veces. */
  trabajando?: boolean;
  alCancelar: () => void;
  alSeguir: () => void;
}) {
  const cuantos = coincidencias.length;
  const seguros = coincidencias.filter((c) =>
    c.contra.some((x) => x.mismoEmail || x.parecido === "igual"),
  ).length;

  return (
    <Modal
      abierto={abierto}
      alCerrar={trabajando ? () => undefined : alCancelar}
      eyebrow={cuantos === 1 ? "Puede estar repetido" : "Pueden estar repetidos"}
      titulo={
        cuantos === 1
          ? "Este alumno ya podría estar cargado"
          : `${cuantos} alumnos ya podrían estar cargados`
      }
      ancho="w-[min(640px,calc(100vw-2rem))]"
    >
      <p className="text-[14px] leading-relaxed text-gray-70">
        {cuantos === 1
          ? "Encontré un nombre muy parecido en este mismo curso. Si es la misma persona y se carga igual, va a quedar dos veces: "
          : `Encontré ${cuantos} nombres muy parecidos a otros de este mismo curso. Si son las mismas personas y se cargan igual, van a quedar dos veces: `}
        <strong className="text-ink">dos planes de cuotas</strong>, así que el
        grupo va a figurar cobrando de más, y{" "}
        <strong className="text-ink">
          a la familia le van a llegar los mails por duplicado
        </strong>
        , la invitación y después cada recordatorio.
      </p>

      {seguros > 0 && (
        <p className="nota mt-3 flex items-start gap-2 text-[12px] text-marca">
          <IconoAlerta className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {seguros === 1
            ? "Uno de estos tiene el mismo email o exactamente las mismas palabras en el nombre. Es casi seguro que es la misma persona."
            : `${seguros} de estos tienen el mismo email o exactamente las mismas palabras en el nombre. Es casi seguro que son la misma persona.`}
        </p>
      )}

      <ul className="mt-4 max-h-[42vh] divide-y divide-gray-20 overflow-y-auto border border-gray-20">
        {coincidencias.map((c) => (
          <li key={c.nuevo} className="px-3.5 py-3">
            <div className="font-rotulo text-[11.5px] tracking-[0.06em] uppercase">
              Se está por cargar: {c.nuevo}
            </div>
            {c.contra.map((x, i) => (
              <div
                key={i}
                className="mt-2 border-l-2 border-gray-20 pl-3 text-[13.5px]"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-ink">{x.nombre}</span>
                  <span className="nota text-[11.5px]">
                    {x.enLaLista
                      ? "en esta misma lista"
                      : x.parecido === "igual"
                        ? "mismas palabras, otro orden"
                        : "el nombre está contenido"}
                  </span>
                </div>
                <div className="nota mt-0.5 flex flex-wrap gap-x-3 text-[11.5px]">
                  <span>{x.emailContacto ?? "sin email"}</span>
                  {x.mismoEmail && (
                    <span className="text-marca">mismo email</span>
                  )}
                  {!x.enLaLista && (
                    <span>{x.invitadaEl ? "ya invitada" : "sin invitar"}</span>
                  )}
                </div>
              </div>
            ))}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        {/* Cancelar primero y con el peso visual del botón principal: lo que
            casi siempre conviene es volver y corregir la lista, no seguir. */}
        <Boton onClick={alCancelar} disabled={trabajando}>
          Volver y revisar
        </Boton>
        <Boton variante="fantasma" onClick={alSeguir} disabled={trabajando}>
          {trabajando
            ? "Creando en Talo…"
            : cuantos === 1
              ? "Es otra persona, agregar igual"
              : "Son otras personas, cargar igual"}
        </Boton>
      </div>
    </Modal>
  );
}
