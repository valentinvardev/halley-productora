"use client";

import { useEffect, useState } from "react";

import { IconoAlerta, IconoSobre } from "~/app/_components/iconos";
import { Modal } from "~/app/_components/modal";
import { Boton, Etiqueta } from "~/app/_components/ui";
import { api } from "~/trpc/react";

/**
 * Mandar invitaciones o recordatorios a varios colegios de una.
 *
 * Lo que distingue a esta pantalla de apretar "invitar a todos" en cada grupo
 * no es el alcance, es el ritmo y lo que se ve antes de apretar.
 *
 * El 24 y el 25 de septiembre de 2026 una carga grande mandó doscientos mails
 * de golpe, se agotó la cuota diaria del proveedor y 251 avisos nunca salieron,
 * para 170 familias. Nadie se enteró hasta días después. Por eso acá: primero
 * se dice a cuántos se le va a escribir y a cuántos no y por qué, y después se
 * manda de a tandas con una pausa, mostrando el avance.
 *
 * El envío lo maneja la pantalla y no el servidor a propósito. Una sola llamada
 * con cuatrocientos destinatarios se pasa del tiempo de respuesta y queda a
 * medias sin que nadie sepa dónde. De a tandas, lo que se cortó se ve.
 */

/** Cuánto se espera entre tandas. Suficiente para no parecer una ráfaga. */
const PAUSA_MS = 1500;
const TANDA = 25;

type Opcion = { id: string | null; nombre: string; cursos: number };

export function EnvioMasivo({
  abierto,
  alCerrar,
  opciones,
  inicial,
  alTerminar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  /** Los colegios, más los grupos sueltos como una opción con id nulo. */
  opciones: Opcion[];
  /** El colegio desde el que se abrió, que viene tildado. */
  inicial: string | null;
  alTerminar: (mensaje: string) => Promise<void> | void;
}) {
  const [tipo, setTipo] = useState<"invitacion" | "recordatorio">("invitacion");
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [elegidos, setElegidos] = useState<(string | null)[]>([]);
  /** Null mientras no se está mandando; si no, el avance. */
  const [envio, setEnvio] = useState<{
    hechos: number;
    total: number;
    enviados: number;
    fallados: { alumno: string; motivo: string }[];
  } | null>(null);

  // Al abrir se arranca limpio y con el colegio desde el que se entró tildado.
  useEffect(() => {
    if (!abierto) return;
    setElegidos([inicial]);
    setTipo("invitacion");
    setSoloPendientes(true);
    setEnvio(null);
  }, [abierto, inicial]);

  const clave = JSON.stringify([...elegidos].sort());
  const { data: previo, isFetching } = api.envio.destinatarios.useQuery(
    { colegioIds: elegidos, tipo, soloPendientes },
    { enabled: abierto && elegidos.length > 0 },
  );
  void clave;

  const tanda = api.envio.tanda.useMutation();
  const mandando = envio !== null && envio.hechos < envio.total;

  const alternar = (id: string | null) =>
    setElegidos((s) =>
      s.some((x) => x === id) ? s.filter((x) => x !== id) : [...s, id],
    );

  async function mandar() {
    const ids = previo?.alumnoIds ?? [];
    if (ids.length === 0) return;

    const estado = {
      hechos: 0,
      total: ids.length,
      enviados: 0,
      fallados: [] as { alumno: string; motivo: string }[],
    };
    setEnvio({ ...estado });

    for (let i = 0; i < ids.length; i += TANDA) {
      const lote = ids.slice(i, i + TANDA);
      try {
        const r = await tanda.mutateAsync({ alumnoIds: lote, tipo });
        estado.enviados += r.enviados;
        estado.fallados.push(...r.fallados);
      } catch (e) {
        estado.fallados.push({
          alumno: `tanda de ${lote.length}`,
          motivo: e instanceof Error ? e.message : "no se pudo",
        });
      }
      estado.hechos += lote.length;
      setEnvio({ ...estado });

      // La pausa es lo que evita la ráfaga. La última tanda no espera.
      if (i + TANDA < ids.length) {
        await new Promise((r) => setTimeout(r, PAUSA_MS));
      }
    }

    await alTerminar(
      `${estado.enviados} mail${estado.enviados === 1 ? "" : "s"} enviado${
        estado.enviados === 1 ? "" : "s"
      }` +
        (estado.fallados.length
          ? ` · ${estado.fallados.length} sin salir`
          : ""),
    );
  }

  const chip = (activo: boolean) =>
    `cursor-pointer border px-3 py-2 font-rotulo text-[11.5px] tracking-[0.06em] uppercase transition-colors ${
      activo
        ? "border-ink bg-ink text-paper"
        : "border-gray-20 text-gray-70 hover:border-ink hover:text-ink"
    }`;

  const descartes = Object.entries(previo?.descartes ?? {});

  return (
    <Modal
      abierto={abierto}
      alCerrar={mandando ? () => undefined : alCerrar}
      eyebrow="Envío en masa"
      titulo="Enviar notificación"
      ancho="w-[min(720px,calc(100vw-2rem))]"
    >
      {/* ------------------------------------------------------- qué mandar */}
      <div>
        <Etiqueta>Qué se manda</Etiqueta>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(
            [
              ["invitacion", "Invitación a registrarse"],
              ["recordatorio", "Recordatorio de cuota"],
            ] as const
          ).map(([v, texto]) => (
            <button
              key={v}
              type="button"
              disabled={mandando}
              onClick={() => setTipo(v)}
              className={chip(tipo === v)}
            >
              {texto}
            </button>
          ))}
        </div>
        <p className="nota mt-1.5 max-w-[62ch] text-[11.5px]">
          {tipo === "invitacion"
            ? "El mail con el link para que la familia se registre y vea su plan."
            : "El aviso de la cuota que sigue. No le llega a quien todavía no fue invitado ni a quien está al día."}
        </p>
      </div>

      {tipo === "invitacion" && (
        <label className="mt-4 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={soloPendientes}
            disabled={mandando}
            onChange={(e) => setSoloPendientes(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-ink)]"
          />
          <span className="min-w-0">
            <span className="block font-rotulo text-[11.5px] tracking-[0.06em] uppercase">
              Sólo a los que falta invitar
            </span>
            <span className="nota mt-0.5 block text-[11.5px]">
              {soloPendientes
                ? "A quien ya recibió la invitación no se le escribe de nuevo."
                : "Se le reenvía a todos, incluso a los que ya se registraron."}
            </span>
          </span>
        </label>
      )}

      {/* --------------------------------------------------------- a quiénes */}
      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Etiqueta>A qué colegios</Etiqueta>
          <span className="flex gap-2">
            <button
              type="button"
              disabled={mandando}
              onClick={() => setElegidos(opciones.map((o) => o.id))}
              className="cursor-pointer font-rotulo text-[11px] tracking-[0.06em] text-gray-45 uppercase hover:text-ink"
            >
              Todos
            </button>
            <button
              type="button"
              disabled={mandando}
              onClick={() => setElegidos([])}
              className="cursor-pointer font-rotulo text-[11px] tracking-[0.06em] text-gray-45 uppercase hover:text-ink"
            >
              Ninguno
            </button>
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {opciones.map((o) => (
            <button
              key={o.id ?? "sueltos"}
              type="button"
              disabled={mandando}
              onClick={() => alternar(o.id)}
              className={chip(elegidos.some((x) => x === o.id))}
            >
              {o.nombre}
              <span className="ml-2 font-mono text-[10px] opacity-60">
                {o.cursos}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------- lo que va a pasar */}
      <div className="mt-5 border border-gray-20 bg-paper-dim px-3.5 py-3">
        {elegidos.length === 0 ? (
          <p className="nota text-[13px]">Elegí al menos un colegio.</p>
        ) : isFetching && !previo ? (
          <p className="nota text-[13px]">Contando…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="font-rotulo text-[11.5px] tracking-[0.08em] text-gray-45 uppercase">
                Se le va a escribir a
              </span>
              <span className="font-display text-[19px] tabular-nums">
                {previo?.total ?? 0} familia
                {previo?.total === 1 ? "" : "s"}
                <span className="ml-2 text-[13px] text-gray-45">
                  de {previo?.grupos ?? 0} curso
                  {previo?.grupos === 1 ? "" : "s"}
                </span>
              </span>
            </div>

            {/* Decir a cuántos no y por qué: "40 de 103" sin el resto es un
                número que no se puede auditar. */}
            {descartes.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-20 pt-2.5">
                {descartes.map(([motivo, cuantos]) => (
                  <span key={motivo} className="nota text-[11.5px]">
                    {cuantos} {motivo}
                  </span>
                ))}
              </div>
            )}

            {(previo?.total ?? 0) > 100 && (
              <p className="nota mt-2.5 flex items-start gap-2 text-[11.5px] text-marca">
                <IconoAlerta className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Son muchos de una. Va de a {TANDA} con pausa, pero si el
                proveedor tiene tope diario conviene partirlo en dos días.
              </p>
            )}
          </>
        )}
      </div>

      {/* ------------------------------------------------------- el progreso */}
      {envio && (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="font-rotulo text-[11.5px] tracking-[0.08em] text-gray-45 uppercase">
              {mandando ? "Mandando" : "Terminado"}
            </span>
            <span className="font-display text-[14px] tabular-nums">
              {envio.hechos} de {envio.total} · {envio.enviados} enviados
              {envio.fallados.length > 0 &&
                ` · ${envio.fallados.length} sin salir`}
            </span>
          </div>
          <div className="mt-1.5 h-[3px] w-full bg-gray-20">
            <div
              className="h-full bg-ink transition-[width] duration-300"
              style={{
                width: `${envio.total ? (envio.hechos / envio.total) * 100 : 0}%`,
              }}
            />
          </div>
          {envio.fallados.length > 0 && !mandando && (
            <ul className="mt-2 max-h-[18vh] overflow-y-auto">
              {envio.fallados.slice(0, 20).map((f, i) => (
                <li key={i} className="nota text-[11.5px]">
                  {f.alumno}: {f.motivo}
                </li>
              ))}
            </ul>
          )}
          {mandando && (
            <p className="nota mt-1.5 text-[11.5px]">
              No cierres esta ventana: el envío lo lleva esta pantalla.
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Boton variante="fantasma" onClick={alCerrar} disabled={mandando}>
          {envio && !mandando ? "Cerrar" : "Cancelar"}
        </Boton>
        <Boton
          onClick={() => void mandar()}
          disabled={mandando || (previo?.total ?? 0) === 0 || envio !== null}
        >
          <IconoSobre />
          {mandando
            ? "Mandando…"
            : envio
              ? "Listo"
              : `Enviar a ${previo?.total ?? 0}`}
        </Boton>
      </div>
    </Modal>
  );
}
