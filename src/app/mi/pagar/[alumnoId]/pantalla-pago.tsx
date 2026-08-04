"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DatosTransferencia } from "~/app/_components/datos-transferencia";
import { BarraCarga } from "~/app/_components/esqueleto";
import { IconoVolver } from "~/app/_components/iconos";
import { Marca } from "~/app/_components/marca";
import { Boton, BotonTexto, botonFantasma } from "~/app/_components/ui";
import { fecha, pesos } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

/**
 * Cuánto dura el festejo antes de que aparezca lo que viene.
 *
 * El tilde tiene que poder leerse como un final —"listo, pagué"— antes de que
 * la pantalla vuelva a hablar de plata. Si la próxima cuota entra junto con la
 * confirmación, el alivio dura cero.
 */
const MS_HASTA_LA_PROXIMA = 2200;

/**
 * La pantalla de cobro: el monto exacto y cómo pagarlo — según el grupo, los
 * datos para transferir o el botón de Mercado Pago.
 *
 * No guarda estado propio del pago — pregunta al backend hasta que la
 * transferencia se acredita y ahí vuelve sola al panel. Que la página no pueda
 * "creerse" que se pagó es justamente lo que evita que muestre algo distinto
 * de lo que dicen los pagos.
 */
export function PantallaPago({
  alumnoId,
  hastaCuotaId,
  inicial,
}: {
  alumnoId: string;
  hastaCuotaId?: string;
  inicial: RouterOutputs["cuenta"]["cobro"];
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const [esperando, setEsperando] = useState(false);

  // Si ya estaba saldado al entrar, no hubo pago que festejar: se avisa y se
  // deja volver a mano, sin la animación ni el redirect.
  const [yaVenia] = useState(inicial.listo);

  const { data } = api.cuenta.cobro.useQuery(
    { alumnoId, hastaCuotaId },
    {
      initialData: inicial,
      refetchInterval: (query) =>
        query.state.data?.listo ? false : esperando ? 700 : 3000,
    },
  );

  const recienPagado = data.listo && !yaVenia;

  /** Se destapa un rato después del tilde: primero el alivio, después lo que viene. */
  const [mostrarProxima, setMostrarProxima] = useState(false);

  useEffect(() => {
    if (!recienPagado) return;
    const reloj = setTimeout(
      () => setMostrarProxima(true),
      MS_HASTA_LA_PROXIMA,
    );
    return () => clearTimeout(reloj);
  }, [recienPagado]);

  /**
   * Vuelve al panel dejándolo al día.
   *
   * El panel guarda su propia copia en React Query con un staleTime de 30s: si
   * no se toca, la familia vuelve y ve la cuota que acaba de pagar todavía
   * impaga. Va `reset` y no `invalidate` a propósito — invalidar la marca vieja
   * pero la deja en la caché, así que el panel igual pinta una vez con los datos
   * de antes. Al vaciarla entra el `initialData` que el servidor acaba de
   * calcular y la cuota aparece pagada en el primer frame.
   */
  const volverAlPanel = async () => {
    await utils.cuenta.panel.reset();
    router.push("/mi");
    router.refresh();
  };

  /** La primera que sigue sin saldar, para anunciarla después del festejo. */
  const proxima = data.plan.cuotas.find((c) => c.estado !== "PAGADA") ?? null;

  const refrescar = () =>
    utils.cuenta.cobro.invalidate({ alumnoId, hastaCuotaId });

  const reportar = api.cuenta.reportarTransferencia.useMutation({
    onSuccess: refrescar,
  });
  const simular = api.pago.simularDesdeCuenta.useMutation({
    onSuccess: async () => {
      setEsperando(true);
      await refrescar();
    },
  });

  // Checkout Pro: se crea la preferencia y se manda a la familia a Mercado Pago.
  const preferencia = api.pago.crearPreferencia.useMutation({
    onSuccess: (r) => {
      window.location.href = r.urlPago;
    },
  });
  const yendoAMp = preferencia.isPending || preferencia.isSuccess;

  const varias = data.numeros.length > 1;

  /**
   * Estamos esperando que entre la plata: o porque la familia avisó que
   * transfirió, o porque se acaba de disparar la transferencia simulada. Son
   * dos caminos distintos hacia la misma espera.
   */
  const esperandoPago =
    esperando || simular.isPending || !!data.reportoTransferenciaEl;

  return (
    <div className="flex min-h-screen flex-col bg-paper-dimmer px-4 py-8">
      <div className="mx-auto w-full max-w-[380px]">
        <Link
          href="/mi"
          className="inline-flex items-center gap-2 font-rotulo text-[11.5px] uppercase tracking-[0.06em] text-gray-45 hover:text-ink"
        >
          <IconoVolver className="h-3 w-3" />
          Volver a mi panel
        </Link>

        <div className="mt-4 border border-ink bg-lienzo px-7 py-8">
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

          {data.listo ? (
            /* ------------------------------------------------ acreditado */
            <div className="mt-8 flex flex-col items-center text-center">
              <Marca
                tipo="confirmado"
                className="h-24 w-24"
                grosor={3}
                animar={recienPagado}
              />

              {recienPagado ? (
                <>
                  <div className="mt-6 font-rotulo text-[12px] uppercase tracking-[0.1em]">
                    Pago acreditado
                  </div>
                  <div className="mt-2 font-display text-[34px] leading-none">
                    {pesos(data.plan.pagado)}
                  </div>
                  <p className="mt-5 text-[13px] leading-relaxed text-gray-70">
                    {data.plan.deuda === 0
                      ? "Con esto queda saldado el plan completo."
                      : "Ya está registrado."}{" "}
                    Te mandamos el comprobante por email.
                  </p>

                  {/* Lo que viene. Entra después, no junto con el tilde. */}
                  <div
                    className="proxima-cuota mt-8 w-full"
                    data-visible={mostrarProxima}
                  >
                    {/* Un solo hijo: la fila que se anima es una, y todo lo que
                        se despliega tiene que vivir adentro. */}
                    <div>
                      {proxima ? (
                        <div className="border border-ink px-5 py-4 text-left">
                          <div className="font-rotulo text-[10.5px] uppercase tracking-[0.14em] text-gray-45">
                            Próxima cuota
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
                            <span className="font-display text-[26px] leading-none">
                              {pesos(proxima.saldo)}
                            </span>
                            <span className="font-rotulo text-[11.5px] uppercase tracking-[0.06em] text-gray-70">
                              Cuota {proxima.numero} · vence{" "}
                              {fecha(proxima.venceEl)}
                            </span>
                          </div>
                          <p className="nota mt-2 text-[12px]">
                            Te queda {pesos(data.plan.deuda)} para terminar el
                            plan.
                          </p>
                        </div>
                      ) : (
                        <div className="border border-ink px-5 py-4">
                          <div className="font-rotulo text-[11px] uppercase tracking-[0.1em]">
                            No queda nada por pagar
                          </div>
                          <p className="nota mt-1.5 text-[12px]">
                            Pagaste las {data.totalCuotas} cuotas. La galería
                            queda liberada.
                          </p>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => void volverAlPanel()}
                        className={`mt-4 w-full ${botonFantasma}`}
                      >
                        Volver a mi panel
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-6 font-rotulo text-[12px] uppercase tracking-[0.1em]">
                    {data.plan.deuda === 0
                      ? "Plan saldado"
                      : "Sin saldo pendiente acá"}
                  </div>
                  <p className="mt-4 text-[13px] leading-relaxed text-gray-70">
                    {data.plan.deuda === 0
                      ? `Pagaste las ${data.totalCuotas} cuotas. No queda nada por transferir.`
                      : "Estas cuotas ya estaban pagas. Elegí otra desde tu panel."}
                  </p>
                  <Link href="/mi" className={`mt-6 ${botonFantasma}`}>
                    Volver a mi panel
                  </Link>
                </>
              )}
            </div>
          ) : (
            /* -------------------------------------------------- a pagar */
            <>
              <div className="mt-5 font-display text-[40px] leading-none">
                {pesos(data.monto)}
              </div>
              <div className="mt-1.5 font-rotulo text-[12px] tracking-[0.05em] text-gray-70">
                {varias
                  ? `CUOTAS ${data.numeros.join(", ")} DE ${data.totalCuotas}`
                  : `CUOTA ${data.numeros[0]} DE ${data.totalCuotas}`}
                {data.venceEl && (
                  <>
                    {" · "}
                    {data.vencida ? "VENCIÓ" : "VENCE"} {fecha(data.venceEl)}
                  </>
                )}
              </div>

              {varias && (
                <p className="nota mt-2">
                  {data.proveedor === "MERCADOPAGO"
                    ? `Un solo pago por las ${data.numeros.length} cuotas.`
                    : `Una sola transferencia por las ${data.numeros.length} cuotas.`}
                </p>
              )}

              {data.proveedor === "MERCADOPAGO" ? (
                /* --------------------------------------- Checkout Pro */
                <div className="mt-7">
                  <Boton
                    className="w-full"
                    onClick={() =>
                      preferencia.mutate({ alumnoId, hastaCuotaId })
                    }
                    disabled={yendoAMp}
                  >
                    {yendoAMp ? "Redirigiendo…" : "Pagar con Mercado Pago"}
                  </Boton>
                  <p className="nota mt-3 text-center">
                    Te lleva a Mercado Pago para pagar con tarjeta, dinero en
                    cuenta o efectivo. Cuando termines, volvés solo a tu panel.
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

                  {/* Una vez que la familia avisó que transfirió, la pantalla
                  queda esperando algo que no depende de ella. La barra es para
                  eso: no promete un porcentaje que nadie conoce, sólo dice que
                  el sistema sigue mirando. */}
                  {esperandoPago ? (
                    <div className="mt-6 border border-ink px-4 py-4 text-center">
                      <BarraCarga />
                      <div className="mt-3.5 font-rotulo text-[12px] uppercase tracking-[0.08em]">
                        Esperando la acreditación
                      </div>
                      <p className="nota mt-1.5 text-[11.5px] text-gray-45">
                        Suele tardar unos segundos. Cuando entre, volvés solo a
                        tu panel.
                      </p>
                    </div>
                  ) : (
                    <Boton
                      className="mt-6 w-full"
                      onClick={() => reportar.mutate({ alumnoId })}
                      disabled={reportar.isPending}
                    >
                      {reportar.isPending ? "Avisando…" : "Ya transferí"}
                    </Boton>
                  )}

                  {data.modoDemo && (
                    <div className="mt-6 border-t border-gray-20 pt-4 text-center">
                      <div className="mb-2 font-rotulo text-[10.5px] uppercase tracking-[0.1em] text-gray-45">
                        Demo — Talo simulado
                      </div>
                      {esperandoPago ? (
                        <span className="font-rotulo text-[11.5px] uppercase tracking-[0.06em] text-gray-45">
                          Transferencia enviada al webhook
                        </span>
                      ) : (
                        <BotonTexto
                          onClick={() =>
                            simular.mutate({ alumnoId, monto: data.monto })
                          }
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
      </div>
    </div>
  );
}
