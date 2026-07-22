"use client";

import { useState } from "react";

import { salir } from "~/app/_acciones/sesion";
import { Copiar } from "~/app/_components/copiar";
import { Marca } from "~/app/_components/marca";
import { PlanCuotas } from "~/app/_components/plan-cuotas";
import { BotonTema } from "~/app/_components/tema";
import { BotonTexto, Dato, Vacio } from "~/app/_components/ui";
import { fecha, pesos } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

/**
 * Dashboard de la familia: el estado del pago de principio a fin y el acceso a
 * la galería.
 */
export function Panel({
  email,
  inicial,
}: {
  email: string;
  inicial: RouterOutputs["cuenta"]["panel"];
}) {
  const utils = api.useUtils();
  const [esperando, setEsperando] = useState(false);

  const { data: hijos } = api.cuenta.panel.useQuery(undefined, {
    initialData: inicial,
    refetchInterval: esperando ? 700 : 15000,
  });

  const simular = api.pago.simularDesdeCuenta.useMutation({
    onSuccess: async () => {
      setEsperando(true);
      await utils.cuenta.panel.invalidate();
      setTimeout(() => setEsperando(false), 12000);
    },
  });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-gray-20 bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[760px] items-center justify-between px-6">
          <span className="font-display text-[15px] font-semibold">
            Halley — mis pagos
          </span>
          <div className="flex items-center gap-5">
            <span className="hidden font-mono text-[10.5px] text-gray-45 sm:inline">
              {email}
            </span>
            <BotonTema />
            <form action={salir}>
              <button
                type="submit"
                className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.06em] text-gray-45 hover:text-ink"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-6 py-10">
        {hijos.length === 0 && (
          <Vacio>
            Tu cuenta todavía no tiene ningún alumno asociado — usá el link que
            te pasó Halley
          </Vacio>
        )}

        <div className="grid gap-12">
          {hijos.map((hijo) => (
            <section key={hijo.id}>
              <div className="eyebrow">
                {hijo.grupo.nombre} — {hijo.grupo.colegio}
              </div>
              <h1 className="mt-1 text-[26px] leading-tight">{hijo.nombre}</h1>

              {/* Estado del plan */}
              <div className="mt-6 flex flex-wrap border border-ink">
                <Dato rotulo="Plan" valor={pesos(hijo.plan.total)} />
                <Dato rotulo="Pagado" valor={pesos(hijo.plan.pagado)} />
                <Dato
                  rotulo="Falta"
                  valor={pesos(hijo.plan.deuda)}
                  detalle={
                    hijo.plan.deuda === 0
                      ? "Plan completo"
                      : hijo.plan.alDia
                        ? "Al día"
                        : "Con cuotas vencidas"
                  }
                />
                {hijo.plan.aFavor > 0 && (
                  <Dato rotulo="A favor" valor={pesos(hijo.plan.aFavor)} />
                )}
              </div>

              {/* Cómo pagar la próxima */}
              {hijo.plan.proxima ? (
                <div className="mt-6 border border-ink p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <div className="eyebrow">
                        Cuota {hijo.plan.proxima.numero} — vence{" "}
                        {fecha(hijo.plan.proxima.venceEl)}
                      </div>
                      <div className="mt-1 font-display text-[34px] leading-none">
                        {pesos(hijo.plan.proxima.saldo)}
                      </div>
                    </div>
                    {hijo.plan.proxima.estado === "VENCIDA" && (
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-marca">
                        Vencida
                      </span>
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-between border border-ink px-3 py-2.5">
                    <span className="font-mono text-[12px] break-all">
                      {hijo.alias}
                    </span>
                    <Copiar valor={hijo.alias} etiqueta="Alias" />
                  </div>
                  <div className="mt-2 flex items-center justify-between px-1">
                    <span className="font-mono text-[10px] text-gray-45">
                      CVU {hijo.cvu}
                    </span>
                    <Copiar valor={hijo.cvu} etiqueta="CVU" />
                  </div>

                  <p className="mt-4 font-mono text-[10.5px] leading-relaxed text-gray-45">
                    Transferí desde tu banco o billetera. Cuando se acredite lo
                    vas a ver acá y te llega el comprobante por mail.
                  </p>

                  {hijo.modoDemo && (
                    <div className="mt-5 border-t border-gray-20 pt-4 text-center">
                      <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-gray-45">
                        Demo — Talo simulado
                      </div>
                      {esperando ? (
                        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-gray-70">
                          Esperando la acreditación…
                        </span>
                      ) : (
                        <BotonTexto
                          onClick={() => simular.mutate({ alumnoId: hijo.id })}
                          disabled={simular.isPending}
                        >
                          Simular transferencia desde el banco
                        </BotonTexto>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-6 flex items-center gap-4 border border-ink p-6">
                  <Marca tipo="confirmado" className="h-12 w-12" grosor={3} />
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.08em]">
                      Plan saldado
                    </div>
                    <p className="mt-1 text-[13px] text-gray-70">
                      No queda nada por pagar. Gracias.
                    </p>
                  </div>
                </div>
              )}

              {/* Quiénes más gestionan esta cuota */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border border-gray-20 bg-paper-dim px-4 py-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-gray-45">
                    Responsables de {hijo.nombre.split(" ")[0]}
                  </div>
                  <div className="mt-1 font-mono text-[11px]">
                    {hijo.responsables
                      .map((r) => (r.soyYo ? `${r.email} (vos)` : r.email))
                      .join(" · ")}
                  </div>
                </div>

                {hijo.lugaresLibres > 0 && (
                  <div className="text-right">
                    <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-gray-45">
                      Queda{hijo.lugaresLibres > 1 ? "n" : ""}{" "}
                      {hijo.lugaresLibres} lugar
                      {hijo.lugaresLibres > 1 ? "es" : ""}
                    </div>
                    <Copiar
                      valor={hijo.linkRegistro}
                      etiqueta="Copiar link para el otro responsable"
                    />
                  </div>
                )}
              </div>

              {/* El plan completo */}
              <h2 className="mt-10 mb-3 text-[17px]">Tus cuotas</h2>
              <PlanCuotas
                cuotas={hijo.plan.cuotas}
                destacar={hijo.plan.proxima?.id}
              />

              {/* Galería */}
              <h2 className="mt-10 mb-3 text-[17px]">Galería</h2>
              {hijo.galerias.length === 0 ? (
                <Vacio>Todavía no hay galería publicada para este grupo</Vacio>
              ) : (
                <div className="grid gap-3">
                  {hijo.galerias.map((galeria) => (
                    <div
                      key={galeria.id}
                      className="flex flex-wrap items-center justify-between gap-3 border border-ink px-5 py-4"
                    >
                      <div>
                        <div className="text-[14px]">{galeria.titulo}</div>
                        <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-gray-45">
                          {galeria.venceEl
                            ? galeria.vigente
                              ? `Disponible hasta ${fecha(galeria.venceEl)}`
                              : `Venció el ${fecha(galeria.venceEl)} — queda la copia en Drive`
                            : "Sin fecha de vencimiento"}
                        </div>
                      </div>

                      {galeria.linkDrive ? (
                        <a
                          href={galeria.linkDrive}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[10.5px] uppercase tracking-[0.05em] underline underline-offset-2 hover:text-gray-70"
                        >
                          Abrir en Drive
                        </a>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-gray-45">
                          Sin link todavía
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
