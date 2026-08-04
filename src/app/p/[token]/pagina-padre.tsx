"use client";

import Link from "next/link";
import { useState } from "react";

import { AvisosGrupo } from "~/app/_components/avisos-grupo";
import { DatosTransferencia } from "~/app/_components/datos-transferencia";
import { GaleriaEntrega } from "~/app/_components/galeria-entrega";
import { Marca } from "~/app/_components/marca";
import { PlanCuotas } from "~/app/_components/plan-cuotas";
import { Boton, BotonTexto } from "~/app/_components/ui";
import { fecha, pesos } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

/**
 * El link personal sin login. Muestra la cuota que toca pagar, cómo pagarla y
 * abajo el plan completo. Invita a registrarse pero no lo exige.
 */
export function PaginaPadre({
  token,
  inicial,
}: {
  token: string;
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

  const preferencia = api.pago.crearPreferenciaDesdeToken.useMutation({
    onSuccess: (r) => {
      window.location.href = r.urlPago;
    },
  });
  const yendoAMp = preferencia.isPending || preferencia.isSuccess;

  const proxima = data.plan.proxima;

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dimmer px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="border border-ink bg-lienzo px-7 py-8">
          <div className="eyebrow">
            {data.grupo.nombre} — {data.grupo.colegio}
          </div>
          <h1 className="mt-1 text-[20px]">{data.nombre}</h1>
          {data.modoPrueba && (
            <div className="mt-4 border border-marca bg-marca/5 px-3.5 py-2.5">
              <div className="font-rotulo text-[10.5px] uppercase tracking-[0.12em] text-marca">
                Modo prueba
              </div>
              <p className="nota mt-0.5 text-[11.5px]">
                Este grupo está en prueba: los pagos se simulan y no se cobra
                nada de verdad.
              </p>
            </div>
          )}

          {!proxima ? (
            /* --------------------------------------------- plan saldado */
            <div className="mt-8 flex flex-col items-center text-center">
              <Marca tipo="confirmado" className="h-24 w-24" grosor={3} animar />
              <div className="mt-6 font-rotulo text-[12px] uppercase tracking-[0.1em]">
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
              <div className="mt-1.5 font-rotulo text-[12px] tracking-[0.05em] text-gray-70">
                {proxima.estado === "VENCIDA" ? "VENCIÓ" : "VENCE"}{" "}
                {fecha(proxima.venceEl)} · CUOTA {proxima.numero} DE{" "}
                {data.plan.cuotas.length}
              </div>

              {data.proveedor === "MERCADOPAGO" ? (
                /* --------------------------------------- Checkout Pro */
                <div className="mt-7">
                  <Boton
                    className="w-full"
                    onClick={() => preferencia.mutate({ token })}
                    disabled={yendoAMp}
                  >
                    {yendoAMp ? "Redirigiendo…" : "Pagar con Mercado Pago"}
                  </Boton>
                  <p className="nota mt-3 text-center">
                    Te lleva a Mercado Pago para pagar con tarjeta, dinero en
                    cuenta o efectivo.
                  </p>
                  {preferencia.isError && (
                    <p className="mt-3 text-center text-[12px] text-marca">
                      No se pudo abrir el pago. Probá de nuevo en un momento.
                    </p>
                  )}
                  {data.modoDemo && (
                    <p className="mt-4 text-center font-rotulo text-[10.5px] uppercase tracking-[0.1em] text-gray-45">
                      Demo — Mercado Pago simulado
                    </p>
                  )}
                </div>
              ) : (
                /* -------------------------------------------- Talo / CVU */
                <>
              <DatosTransferencia alias={data.alias} cvu={data.cvu} />

              {data.reportoTransferenciaEl ? (
                <p className="nota mt-6 border border-gray-20 bg-paper px-3 py-3 text-center">
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
                  <div className="mb-2 font-rotulo text-[10.5px] uppercase tracking-[0.1em] text-gray-45">
                    Demo — Talo simulado
                  </div>
                  {esperandoAcreditacion ? (
                    <span className="font-rotulo text-[11.5px] uppercase tracking-[0.06em] text-gray-70">
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
            </>
          )}
        </div>

        {/* El plan completo */}
        <div className="mt-6">
          <div className="eyebrow mb-2">Tus cuotas</div>
          <PlanCuotas cuotas={data.plan.cuotas} destacar={proxima?.id} />
        </div>

        {data.avisos.length > 0 && (
          <div className="mt-8">
            <div className="eyebrow mb-3">Información</div>
            <AvisosGrupo avisos={data.avisos} />
          </div>
        )}

        {/* Galería */}
        {data.galerias.length > 0 && (
          <div className="mt-8">
            <div className="eyebrow mb-3">Galería</div>
            {data.plan.deuda > 0 ? (
              // Se libera al saldar, igual que en el panel: la ruta que sirve
              // las fotos chequea lo mismo, esto sólo evita anunciarlas.
              <p className="nota border border-dashed border-gray-20 bg-paper-dim px-4 py-4">
                Cuando termines de pagar, las fotos aparecen acá para descargar.
                Te faltan {pesos(data.plan.deuda)}.
              </p>
            ) : (
              <div className="grid gap-8">
                {data.galerias.map((g) => (
                  <div key={g.id}>
                    {g.linkDrive && (
                      <div className="mb-3 flex justify-end">
                        <a
                          href={g.linkDrive}
                          target="_blank"
                          rel="noreferrer"
                          className="font-rotulo text-[11.5px] uppercase tracking-[0.05em] underline underline-offset-2 hover:text-gray-70"
                        >
                          Abrir en Drive
                        </a>
                      </div>
                    )}
                    {g.fotos.length > 0 ? (
                      <GaleriaEntrega titulo={g.titulo} fotos={g.fotos} />
                    ) : (
                      <div>
                        <div className="text-[13px]">{g.titulo}</div>
                        <p className="nota mt-1">
                          {g.linkDrive
                            ? "El material está en Drive por ahora."
                            : "Todavía no se subieron fotos."}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!data.tieneCuenta && (
          <p className="nota mt-6 text-center text-gray-45">
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
