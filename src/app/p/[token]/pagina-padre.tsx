"use client";

import Link from "next/link";
import { useState } from "react";

import { Copiar } from "~/app/_components/copiar";
import { Marca } from "~/app/_components/marca";
import { PlanCuotas } from "~/app/_components/plan-cuotas";
import { Boton, BotonTexto } from "~/app/_components/ui";
import { fecha, pesos } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

/**
 * El link personal sin login. Muestra la cuota que toca pagar, el QR y el
 * alias, y abajo el plan completo. Invita a registrarse pero no lo exige.
 */
export function PaginaPadre({
  token,
  qrSvg,
  inicial,
}: {
  token: string;
  qrSvg: string;
  inicial: RouterOutputs["publico"]["porToken"];
}) {
  const utils = api.useUtils();
  const [esperandoAcreditacion, setEsperandoAcreditacion] = useState(false);

  const { data } = api.publico.porToken.useQuery(
    { token },
    {
      initialData: inicial,
      // Sin estado propio: la página siempre refleja lo que dice el backend.
      refetchInterval: (query) =>
        query.state.data?.plan.deuda === 0
          ? false
          : esperandoAcreditacion
            ? 700
            : 3000,
    },
  );

  const refrescar = () => utils.publico.porToken.invalidate({ token });

  const reportar = api.publico.reportarTransferencia.useMutation({
    onSuccess: refrescar,
  });
  const simular = api.pago.simularDesdeToken.useMutation({
    onSuccess: async () => {
      setEsperandoAcreditacion(true);
      await refrescar();
    },
  });

  const proxima = data.plan.proxima;

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dimmer px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="border border-ink bg-lienzo px-7 py-8">
          <div className="eyebrow">
            {data.grupo.nombre} — {data.grupo.colegio}
          </div>
          <h1 className="mt-1 text-[20px]">{data.nombre}</h1>

          {!proxima ? (
            /* --------------------------------------------- plan saldado */
            <div className="mt-8 flex flex-col items-center text-center">
              <Marca tipo="confirmado" className="h-24 w-24" grosor={3} animar />
              <div className="mt-6 font-mono text-[11px] uppercase tracking-[0.1em]">
                Plan saldado
              </div>
              <div className="mt-2 font-display text-[34px] leading-none">
                {pesos(data.plan.pagado)}
              </div>
              <p className="mt-5 text-[13px] leading-relaxed text-gray-70">
                Pagaste las {data.plan.cuotas.length} cuotas. Te mandamos el
                comprobante de cada una por email.
              </p>
            </div>
          ) : (
            /* ------------------------------------------ cuota a pagar */
            <>
              <div className="mt-5 font-display text-[40px] leading-none">
                {pesos(proxima.saldo)}
              </div>
              <div className="mt-1.5 font-mono text-[11px] tracking-[0.04em] text-gray-70">
                {proxima.estado === "VENCIDA" ? "VENCIÓ" : "VENCE"}{" "}
                {fecha(proxima.venceEl)} · CUOTA {proxima.numero} DE{" "}
                {data.plan.cuotas.length}
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
                <span className="font-mono text-[12px] break-all">
                  {data.alias}
                </span>
                <Copiar valor={data.alias} etiqueta="Alias" />
              </div>

              <div className="mt-2 flex items-center justify-between px-1">
                <span className="font-mono text-[10px] text-gray-45">
                  CVU {data.cvu}
                </span>
                <Copiar valor={data.cvu} etiqueta="CVU" />
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
                  {esperandoAcreditacion ? (
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-gray-70">
                      Esperando la acreditación…
                    </span>
                  ) : (
                    <BotonTexto
                      onClick={() => simular.mutate({ token })}
                      disabled={simular.isPending}
                    >
                      Simular transferencia desde el banco
                    </BotonTexto>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* El plan completo */}
        <div className="mt-6">
          <div className="eyebrow mb-2">Tus cuotas</div>
          <PlanCuotas cuotas={data.plan.cuotas} destacar={proxima?.id} />
        </div>

        {/* Galería */}
        {data.galerias.length > 0 && (
          <div className="mt-6">
            <div className="eyebrow mb-2">Galería</div>
            {data.galerias.map((g) => (
              <div
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-2 border border-ink bg-lienzo px-4 py-3"
              >
                <span className="text-[13px]">{g.titulo}</span>
                {g.linkDrive && (
                  <a
                    href={g.linkDrive}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[10.5px] uppercase tracking-[0.05em] underline underline-offset-2"
                  >
                    Abrir en Drive
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {!data.tieneCuenta && (
          <p className="mt-6 text-center font-mono text-[10.5px] leading-relaxed uppercase tracking-[0.06em] text-gray-45">
            Registrate para seguir todo desde un solo lugar —{" "}
            <Link
              href={`/g/${data.grupo.slug}`}
              className="underline underline-offset-2 hover:text-ink"
            >
              crear mi cuenta
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
