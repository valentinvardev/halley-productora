"use client";

import Link from "next/link";

import { Marca } from "~/app/_components/marca";
import { Modal } from "~/app/_components/modal";
import {
  MARCA_ESTADO,
  type CuotaVista,
} from "~/app/_components/plan-cuotas";
import { botonSolido } from "~/app/_components/ui";
import { fecha, pesos } from "~/lib/format";

/**
 * El plan completo con un camino de pago en cada fila.
 *
 * Una aclaración que vale la pena: no se puede pagar la cuota 3 dejando
 * abiertas la 1 y la 2. El dinero se imputa de la más vieja a la más nueva
 * (`imputarPagos`), así que elegir una de más adelante es ponerse al día hasta
 * ahí. En vez de esconderlo, cada botón muestra el monto acumulado que va a
 * cobrar.
 */
export function GestionarCuotas({
  abierto,
  alCerrar,
  alumnoId,
  nombre,
  cuotas,
  deuda,
}: {
  abierto: boolean;
  alCerrar: () => void;
  alumnoId: string;
  nombre: string;
  cuotas: CuotaVista[];
  deuda: number;
}) {
  let acumulado = 0;
  const filas = cuotas.map((cuota) => {
    acumulado += cuota.saldo;
    return { ...cuota, acumulado };
  });

  const primeraImpaga = filas.find((f) => f.saldo > 0);

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      eyebrow={nombre}
      titulo="Gestionar cuotas"
    >
      {deuda === 0 ? (
        <div className="flex items-center gap-4 border border-ink px-5 py-6">
          <Marca tipo="confirmado" className="h-11 w-11 shrink-0" grosor={3} />
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.08em]">
              Plan saldado
            </div>
            <p className="mt-1 text-[13px] text-gray-70">
              Las {cuotas.length} cuotas están pagas. No queda nada por hacer.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="border border-ink">
            {filas.map((fila) => {
              const marca = MARCA_ESTADO[fila.estado];
              const pagada = fila.saldo <= 0;
              const esProxima = fila.id === primeraImpaga?.id;

              return (
                <div
                  key={fila.id}
                  className={`flex items-center gap-3 border-b border-gray-20 px-4 py-3 last:border-b-0 ${
                    esProxima ? "bg-paper-dim" : ""
                  }`}
                >
                  <span className="h-5 w-5 shrink-0">
                    <Marca
                      tipo={marca.tipo}
                      color={marca.color}
                      className="h-full w-full"
                      grosor={fila.estado === "PAGADA" ? 3.5 : 4}
                    />
                  </span>

                  <span className="w-12 shrink-0 font-mono text-[10.5px] tracking-[0.06em] text-gray-45">
                    {String(fila.numero).padStart(2, "0")}
                  </span>

                  <span className="flex-1 font-mono text-[12.5px]">
                    {pesos(fila.monto)}
                    <span className="mt-0.5 block text-[10px] uppercase tracking-[0.05em] text-gray-45">
                      {pagada
                        ? "Pagada"
                        : `${fila.estado === "VENCIDA" ? "Venció" : "Vence"} ${fecha(fila.venceEl)}`}
                    </span>
                  </span>

                  {pagada ? (
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] text-gray-45">
                      Listo
                    </span>
                  ) : (
                    <Link
                      href={`/mi/pagar/${alumnoId}?hasta=${fila.id}`}
                      className="shrink-0 border border-ink px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.05em] hover:bg-ink hover:text-paper"
                    >
                      {esProxima ? "Pagar" : "Hasta acá"}
                      <span className="mt-0.5 block text-[11px] tracking-normal">
                        {pesos(fila.acumulado)}
                      </span>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-3 font-mono text-[10px] leading-relaxed text-gray-45">
            Las cuotas se saldan de la más vieja a la más nueva. Pagar una de
            más adelante incluye las anteriores — por eso el monto sube.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border border-ink bg-paper-dim px-4 py-3.5">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-gray-45">
                Falta en total
              </div>
              <div className="mt-1 font-display text-[24px] leading-none">
                {pesos(deuda)}
              </div>
            </div>
            <Link href={`/mi/pagar/${alumnoId}`} className={botonSolido}>
              Pagar todo
            </Link>
          </div>
        </>
      )}
    </Modal>
  );
}
