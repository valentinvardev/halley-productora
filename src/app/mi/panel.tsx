"use client";

import Link from "next/link";
import { useState } from "react";

import { salir } from "~/app/_acciones/sesion";
import { Barra } from "~/app/_components/barra";
import { itemCajon } from "~/app/_components/cajon";
import { Copiar } from "~/app/_components/copiar";
import { Marca } from "~/app/_components/marca";
import { PlanCuotas } from "~/app/_components/plan-cuotas";
import {
  Boton,
  BotonTexto,
  Dato,
  TiraDatos,
  Vacio,
  botonSolido,
} from "~/app/_components/ui";
import { fecha, pesos } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";
import { GestionarCuotas } from "./gestionar-cuotas";

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
  /** Qué hijo tiene el modal de cuotas abierto. */
  const [gestionando, setGestionando] = useState<string | null>(null);

  const { data: hijos } = api.cuenta.panel.useQuery(undefined, {
    initialData: inicial,
    refetchInterval: 15000,
  });

  return (
    <div className="min-h-screen">
      <Barra
        marca="Halley"
        href="/mi"
        ancho="max-w-[760px]"
        identidad={{ titulo: "Mi cuenta", detalle: email }}
        salir={
          <form action={salir}>
            <button type="submit" className={`${itemCajon} text-gray-45`}>
              Salir
            </button>
          </form>
        }
      />

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

              {hijo.plan.deuda === 0 ? (
                /* Plan terminado: no queda nada que cobrar, así que no queda
                   nada que mostrar del cobro. Sólo el agradecimiento, y el
                   detalle a un clic para quien quiera revisarlo. */
                <div className="mt-6 border border-ink p-7 text-center sm:p-9">
                  <Marca
                    tipo="confirmado"
                    className="mx-auto h-20 w-20"
                    grosor={3}
                  />
                  <h2 className="mt-6 text-[22px] leading-tight">
                    Gracias por confiar en nosotros
                  </h2>
                  <p className="nota mx-auto mt-3 max-w-[46ch]">
                    Las {hijo.plan.cuotas.length} cuotas están pagas: no queda
                    nada por abonar. Te mandamos el comprobante de cada una por
                    email.
                  </p>

                  <div className="mt-7 inline-flex items-baseline gap-3 border-t border-gray-20 pt-4">
                    <span className="font-rotulo text-[11.5px] uppercase tracking-[0.08em] text-gray-45">
                      Total abonado
                    </span>
                    <span className="font-display text-[26px] leading-none">
                      {pesos(hijo.plan.pagado)}
                    </span>
                  </div>

                  <div className="mt-5">
                    <BotonTexto onClick={() => setGestionando(hijo.id)}>
                      Ver el detalle de lo pagado
                    </BotonTexto>
                  </div>
                </div>
              ) : (
                <>
              {/* Estado del plan */}
              <TiraDatos className="mt-6">
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
              </TiraDatos>

              {/* Cómo pagar la próxima */}
              {hijo.plan.proxima && (
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
                      <span className="font-rotulo text-[11.5px] uppercase tracking-[0.06em] text-marca">
                        Vencida
                      </span>
                    )}
                  </div>

                  {/* El QR, el alias y el "ya transferí" viven en la pantalla
                      de cobro: acá alcanza con decir cuánto y llevar hasta
                      ella. */}
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Link
                      href={`/mi/pagar/${hijo.id}?hasta=${hijo.plan.proxima.id}`}
                      className={botonSolido}
                    >
                      Pagar esta cuota
                    </Link>
                    <Boton
                      variante="fantasma"
                      onClick={() => setGestionando(hijo.id)}
                    >
                      Gestionar cuotas
                    </Boton>
                  </div>

                  <p className="nota mt-4">
                    Transferí con el QR o el alias desde tu banco o billetera.
                    Cuando se acredite lo vas a ver acá y te llega el
                    comprobante por mail.
                  </p>
                </div>
              )}
                </>
              )}

              <GestionarCuotas
                abierto={gestionando === hijo.id}
                alCerrar={() => setGestionando(null)}
                alumnoId={hijo.id}
                nombre={hijo.nombre}
                cuotas={hijo.plan.cuotas}
                deuda={hijo.plan.deuda}
              />

              {/* Quiénes más gestionan esta cuota */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border border-gray-20 bg-paper-dim px-4 py-3">
                <div>
                  <div className="font-rotulo text-[11px] uppercase tracking-[0.08em] text-gray-45">
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
                    <div className="font-rotulo text-[11px] uppercase tracking-[0.06em] text-gray-45">
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

              {/* El plan completo. Saldado no se muestra: la lista entera de
                  cuotas pagas no le dice nada nuevo a nadie, y para revisarla
                  está el detalle de la tarjeta de arriba. */}
              {hijo.plan.deuda > 0 && (
                <>
                  <h2 className="mt-10 mb-3 text-[17px]">Tus cuotas</h2>
                  <PlanCuotas
                    cuotas={hijo.plan.cuotas}
                    destacar={hijo.plan.proxima?.id}
                  />
                </>
              )}

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
                        <div className="mt-1 font-rotulo text-[11.5px] uppercase tracking-[0.06em] text-gray-45">
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
                          className="font-rotulo text-[11.5px] uppercase tracking-[0.05em] underline underline-offset-2 hover:text-gray-70"
                        >
                          Abrir en Drive
                        </a>
                      ) : (
                        <span className="font-rotulo text-[11px] uppercase tracking-[0.06em] text-gray-45">
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
