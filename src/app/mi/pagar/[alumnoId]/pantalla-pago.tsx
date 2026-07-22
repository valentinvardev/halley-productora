"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Copiar } from "~/app/_components/copiar";
import { BarraCarga } from "~/app/_components/esqueleto";
import { IconoVolver } from "~/app/_components/iconos";
import { Marca } from "~/app/_components/marca";
import { Boton, BotonTexto, botonFantasma } from "~/app/_components/ui";
import { fecha, pesos } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

/** Cuánto se deja ver la confirmación antes de volver solo al panel. */
const MS_ANTES_DE_VOLVER = 2600;

/**
 * La pantalla de cobro: el QR, el alias y el monto exacto a transferir.
 *
 * No guarda estado propio del pago — pregunta al backend hasta que la
 * transferencia se acredita y ahí vuelve sola al panel. Que la página no pueda
 * "creerse" que se pagó es justamente lo que evita que muestre algo distinto
 * de lo que dicen los pagos.
 */
export function PantallaPago({
  alumnoId,
  hastaCuotaId,
  qrSvg,
  inicial,
}: {
  alumnoId: string;
  hastaCuotaId?: string;
  qrSvg: string;
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

  useEffect(() => {
    if (!recienPagado) return;

    const reloj = setTimeout(() => {
      void (async () => {
        // El panel guarda su propia copia en React Query, con un staleTime de
        // 30s: si no se toca, la familia vuelve y ve la cuota que acaba de
        // pagar todavía impaga hasta que venza ese plazo.
        //
        // Va `reset` y no `invalidate` a propósito. Invalidar la marca vieja
        // pero la deja en la caché, así que el panel igual pinta una vez con
        // los datos de antes y recién después llega el refetch. Al vaciarla,
        // en cambio, entra el `initialData` que el servidor acaba de calcular
        // y la cuota aparece pagada en el primer frame.
        await utils.cuenta.panel.reset();
        router.push("/mi");
        router.refresh();
      })();
    }, MS_ANTES_DE_VOLVER);

    return () => clearTimeout(reloj);
  }, [recienPagado, router, utils]);

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
                      ? `Con esto queda saldado el plan completo. Te mandamos el comprobante por email.`
                      : `Ya está registrado. Te queda ${pesos(data.plan.deuda)} para terminar el plan.`}
                  </p>
                  <p className="mt-6 font-rotulo text-[11px] uppercase tracking-[0.08em] text-gray-45">
                    Volviendo a tu panel…
                  </p>
                </>
              ) : (
                <>
                  <div className="mt-6 font-rotulo text-[12px] uppercase tracking-[0.1em]">
                    {data.plan.deuda === 0 ? "Plan saldado" : "Sin saldo pendiente acá"}
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
                  Una sola transferencia por las {data.numeros.length} cuotas.
                </p>
              )}

              {/* El QR queda siempre en positivo, incluso en modo oscuro: los
                  lectores esperan módulos oscuros sobre fondo claro. */}
              <div
                className="qr mt-6 aspect-square w-full border border-ink p-3 [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />

              <p className="mt-3 text-center font-rotulo text-[11px] uppercase tracking-[0.08em] text-gray-45">
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
                    Suele tardar unos segundos. Cuando entre, volvés solo a tu
                    panel.
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
        </div>
      </div>
    </div>
  );
}
