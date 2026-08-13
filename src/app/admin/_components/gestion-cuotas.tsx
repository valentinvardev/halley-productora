"use client";

import { useState } from "react";

import { IconoAlerta, IconoTilde } from "~/app/_components/iconos";
import { Modal } from "~/app/_components/modal";
import { Boton } from "~/app/_components/ui";
import { fecha, pesos } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * Gestión de cuotas: marcarlas como pagas sin que haya entrado un pago real.
 *
 * Es para lo que pasa siempre: la familia pagó en efectivo, o transfirió a otra
 * cuenta, o arregló de palabra. Hasta ahora eso no tenía cómo entrar al sistema y
 * la cuota quedaba figurando impaga para siempre.
 *
 * Marcar una cuota crea un pago, y no es un rodeo: acá el estado de una cuota no
 * se guarda en ningún lado, se deriva repartiendo lo pagado sobre el plan. No hay
 * tilde que poner. Que la única forma de saldar una cuota sea registrar el pago
 * que la salda es lo que mantiene al panel diciendo lo mismo que dicen los pagos.
 *
 * El monto es lo que falta hoy con la mora incluida, así que la deuda queda en
 * cero exacto y no en "cero menos el recargo".
 */
export function GestionCuotas({
  abierto,
  alCerrar,
  grupoId,
  grupoNombre,
  cuotas,
  alumnos,
  alRefrescar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  grupoId: string;
  grupoNombre: string;
  cuotas: { id: string; numero: number; monto: number; venceEl: string }[];
  alumnos: { id: string; nombre: string }[];
  alRefrescar: (mensaje?: string) => Promise<void>;
}) {
  /**
   * A quién se le marca. Con un solo alumno —bodas, quince— no hay nada que
   * elegir y el selector no aparece.
   */
  const unico = alumnos.length === 1;
  const [alcance, setAlcance] = useState<"alumno" | "grupo">(
    unico ? "alumno" : "grupo",
  );
  const [alumnoId, setAlumnoId] = useState(alumnos[0]?.id ?? "");

  /** Qué se está por confirmar: el número de cuota, o `null` para todas. */
  const [confirmando, setConfirmando] = useState<number | null | false>(false);

  const marcar = api.pago.marcarCuotas.useMutation({
    onSuccess: async (r) => {
      setConfirmando(false);
      await alRefrescar(
        r.registrados === 0
          ? "No había nada que saldar"
          : `${r.registrados} pago${r.registrados === 1 ? "" : "s"} registrado${
              r.registrados === 1 ? "" : "s"
            } por ${pesos(r.total)}`,
      );
      alCerrar();
    },
  });

  const aQuien =
    alcance === "grupo"
      ? `las ${alumnos.length} familias`
      : (alumnos.find((a) => a.id === alumnoId)?.nombre ?? "el alumno");

  return (
    <>
      <Modal
        abierto={abierto}
        alCerrar={alCerrar}
        eyebrow="Cobros"
        titulo="Gestión de cuotas"
      >
        <p className="text-[14px] leading-relaxed text-gray-70">
          Marcar una cuota registra el pago que la salda, por lo que falte hoy con
          la mora incluida. Es para lo que se cobró por fuera del sistema.
        </p>

        {!unico && (
          <div className="mt-5 grid gap-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["grupo", `Todo el grupo · ${alumnos.length}`],
                  ["alumno", "Un alumno"],
                ] as const
              ).map(([valor, texto]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setAlcance(valor)}
                  className={`border px-3.5 py-2 font-rotulo text-[11.5px] tracking-[0.06em] uppercase transition-colors ${
                    alcance === valor
                      ? "border-ink bg-ink text-paper"
                      : "border-gray-20 text-gray-70 hover:border-ink hover:text-ink"
                  }`}
                >
                  {texto}
                </button>
              ))}
            </div>

            {alcance === "alumno" && (
              <select
                value={alumnoId}
                onChange={(e) => setAlumnoId(e.target.value)}
                className="w-full border border-ink bg-lienzo px-3 py-2.5 text-[14px] text-ink"
              >
                {alumnos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <ul className="mt-5 divide-y divide-gray-20 border border-gray-20">
          {cuotas.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <div className="font-rotulo text-[11.5px] tracking-[0.06em] text-gray-45 uppercase">
                  Cuota {c.numero}
                </div>
                <div className="nota text-[12px]">vence {fecha(c.venceEl)}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display text-[15px] tabular-nums">
                  {pesos(c.monto)}
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmando(c.numero)}
                  className="border border-gray-20 px-3 py-1.5 font-rotulo text-[11px] tracking-[0.06em] text-gray-70 uppercase transition-colors hover:border-ink hover:text-ink"
                >
                  Marcar paga
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap justify-between gap-3">
          <Boton variante="fantasma" onClick={() => setConfirmando(null)}>
            <IconoTilde />
            Marcar todas
          </Boton>
          <Boton variante="fantasma" onClick={alCerrar}>
            Cerrar
          </Boton>
        </div>
      </Modal>

      {/* La confirmación va en su propio cartel y no en un `confirm` del
          navegador: acá se registra plata, y el que la aprieta tiene que leer a
          quién y por cuánto antes de hacerlo. */}
      <Modal
        abierto={confirmando !== false}
        alCerrar={() => setConfirmando(false)}
        eyebrow={grupoNombre}
        titulo={
          confirmando === null
            ? "Marcar todas las cuotas"
            : `Marcar la cuota ${confirmando}`
        }
      >
        <p className="text-[14px] leading-relaxed text-gray-70">
          Se registra un pago a nombre de <strong className="text-ink">{aQuien}</strong>{" "}
          por lo que {alcance === "grupo" ? "cada una deba" : "deba"} hoy
          {confirmando === null ? " en todo el plan" : ` en esa cuota`}, con la
          mora incluida.
        </p>

        {alcance === "grupo" && (
          <p className="nota mt-3 flex items-start gap-2 text-marca">
            <IconoAlerta className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Son {alumnos.length} pagos de una vez y no se deshacen desde acá.
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Boton variante="fantasma" onClick={() => setConfirmando(false)}>
            Cancelar
          </Boton>
          <Boton
            onClick={() =>
              marcar.mutate({
                alcance,
                id: alcance === "grupo" ? grupoId : alumnoId,
                cuota: typeof confirmando === "number" ? confirmando : null,
              })
            }
            disabled={marcar.isPending}
          >
            {marcar.isPending ? "Registrando…" : "Registrar el pago"}
          </Boton>
        </div>
      </Modal>
    </>
  );
}
