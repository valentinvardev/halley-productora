"use client";

import { Copiar } from "~/app/_components/copiar";
import { Marca } from "~/app/_components/marca";
import { Boton, BotonTexto } from "~/app/_components/ui";
import { fecha, fechaHora, pesos } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

export function PaginaPadre({
  token,
  qrSvg,
  inicial,
}: {
  token: string;
  qrSvg: string;
  inicial: RouterOutputs["padre"]["porToken"];
}) {
  const utils = api.useUtils();
  const { data } = api.padre.porToken.useQuery(
    { token },
    // Sin estado propio: la página siempre refleja lo que dice el backend.
    { refetchInterval: 3000, initialData: inicial },
  );

  const refrescar = () => utils.padre.porToken.invalidate({ token });

  const reportar = api.padre.reportarTransferencia.useMutation({
    onSuccess: refrescar,
  });
  const simular = api.pago.simularDesdeToken.useMutation({
    onSuccess: refrescar,
  });

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center font-mono text-[11px] uppercase tracking-[0.08em] text-gray-45">
        Cargando…
      </div>
    );
  }

  const pagado = data.estado === "PAGADO";
  const vencido = data.estado === "VENCIDO";
  const ultimoPago = data.pagos[0];

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dimmer px-4 py-10">
      <div className="w-full max-w-[360px] border border-ink bg-lienzo px-7 py-8">
        <div className="eyebrow">
          {data.grupo.nombre} — {data.grupo.colegio}
        </div>
        <h1 className="mt-1 text-[20px]">Hola, {data.nombre.split(" ")[0]}</h1>

        {pagado ? (
          /* ----------------------------------------------------- pagado */
          <div className="mt-8 flex flex-col items-center text-center">
            <Marca tipo="confirmado" className="h-24 w-24" grosor={3} animar />
            <div className="mt-6 font-mono text-[11px] uppercase tracking-[0.1em]">
              Pago acreditado
            </div>
            <div className="mt-2 font-display text-[36px] leading-none">
              {pesos(ultimoPago?.monto ?? data.monto)}
            </div>
            {ultimoPago && (
              <div className="mt-3 font-mono text-[11px] text-gray-70">
                {fechaHora(ultimoPago.recibidoEn)}
              </div>
            )}
            <p className="mt-6 text-[13px] leading-relaxed text-gray-70">
              Cuota {data.grupo.cuotaActual} de {data.grupo.cuotasTotales} saldada.
              Te mandamos el comprobante por email.
            </p>
          </div>
        ) : (
          /* -------------------------------------------- pendiente / vencido */
          <>
            <div className="mt-5 font-display text-[40px] leading-none">
              {pesos(data.monto)}
            </div>
            <div className="mt-1.5 font-mono text-[11px] tracking-[0.04em] text-gray-70">
              {vencido ? "VENCIÓ" : "VENCE"} {fecha(data.grupo.venceEl)} · CUOTA{" "}
              {data.grupo.cuotaActual} DE {data.grupo.cuotasTotales}
            </div>

            {/* El QR queda siempre en positivo, incluso en modo oscuro: los
                lectores esperan módulos oscuros sobre fondo claro. */}
            <div
              className="qr mt-6 aspect-square w-full border border-ink p-3 [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />

            <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-gray-45">
              Escaneá desde tu banco o billetera
            </p>

            <div className="mt-4 flex items-center justify-between border border-ink px-3 py-2.5">
              <span className="font-mono text-[12px] break-all">{data.alias}</span>
              <Copiar valor={data.alias} />
            </div>

            <div className="mt-2 flex items-center justify-between px-1">
              <span className="font-mono text-[10px] text-gray-45">
                CVU {data.cvu}
              </span>
              <Copiar valor={data.cvu} etiqueta="Copiar CVU" />
            </div>

            {data.reportoTransferenciaEl ? (
              <p className="mt-6 border border-gray-20 bg-paper px-3 py-3 text-center font-mono text-[10.5px] uppercase tracking-[0.06em] text-gray-70">
                Avisaste que transferiste. En cuanto se acredite lo vas a ver acá.
              </p>
            ) : (
              <Boton
                className="mt-6 w-full"
                onClick={() => reportar.mutate({ token })}
                disabled={reportar.isPending}
              >
                Ya transferí
              </Boton>
            )}

            {data.modoDemo && (
              <div className="mt-6 border-t border-gray-20 pt-4 text-center">
                <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-gray-45">
                  Demo — Talo simulado
                </div>
                <BotonTexto
                  onClick={() => simular.mutate({ token })}
                  disabled={simular.isPending}
                >
                  {simular.isPending
                    ? "Transfiriendo…"
                    : "Simular transferencia desde el banco"}
                </BotonTexto>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
