"use client";

import Link from "next/link";

import { useState } from "react";

import { Ayuda } from "~/app/_components/ayuda";
import { IconoProbeta, IconoSobre } from "~/app/_components/iconos";
import { Boton, Campo, Encabezado, Tag, Vacio } from "~/app/_components/ui";
import { fechaHora } from "~/lib/format";
import { Desplegable } from "~/app/_components/desplegable";
import { api } from "~/trpc/react";
import { EsqueletoBandeja } from "./esqueletos";

const ROTULO = {
  INVITACION: "Invitación",
  ACCESO: "Link de acceso",
  CONFIRMACION_PADRE: "Confirmación",
  AVISO_ADMIN: "Aviso a Halley",
  RECORDATORIO: "Recordatorio",
  PAGO_PARCIAL: "Pago incompleto",
  PRESUPUESTO: "Presupuesto",
  VALORACION: "Pedido de valoración",
} as const;

export function Bandeja() {
  const { data: notificaciones, isLoading } = api.notificacion.listar.useQuery(
    { limite: 50 },
    { refetchInterval: 3000 },
  );
  const { data: modo } = api.notificacion.modoEnvio.useQuery();
  const [abierta, setAbierta] = useState<string | null>(null);

  return (
    <>
      <Encabezado
        eyebrow="Cobros — notificaciones"
        titulo="Bandeja de salida"
        bajada={
          modo?.enviando
            ? "Cada mensaje queda registrado acá y además sale por Resend. El estado del envío se ve en cada fila."
            : "Todo lo que el sistema enviaría por email. Con EMAIL_MODE=bandeja no sale nada a internet: los mensajes quedan registrados tal cual saldrían."
        }
        acciones={
          <Link
            href="/admin/notificaciones/textos"
            className="inline-flex items-center gap-2 border border-ink px-4 py-2.5 font-rotulo text-[12px] tracking-[0.06em] uppercase transition-colors hover:bg-ink hover:text-paper"
          >
            Editar los textos
          </Link>
        }
      />

      <UsoDeResend />

      <ProbarPlantillas />

      {isLoading && <EsqueletoBandeja soloLista />}
      {!isLoading && notificaciones?.length === 0 && (
        <Vacio>Todavía no se disparó ninguna notificación</Vacio>
      )}

      <div className="border border-ink">
        {notificaciones?.map((n) => {
          const abierto = abierta === n.id;
          return (
            <div key={n.id} className="border-b border-gray-20 last:border-b-0">
              <button
                onClick={() => setAbierta(abierto ? null : n.id)}
                className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-paper-dim"
              >
                <Tag activo={n.tipo === "CONFIRMACION_PADRE"}>
                  {ROTULO[n.tipo]}
                </Tag>
                <span className="flex-1 text-[13.5px]">{n.asunto}</span>
                {n.errorEnvio ? (
                  <Ayuda texto={n.errorEnvio} lado="arriba" largo>
                    <span className="font-rotulo text-[11px] uppercase tracking-[0.06em] text-marca">
                      Falló el envío
                    </span>
                  </Ayuda>
                ) : n.enviadoEl ? (
                  <span className="font-rotulo text-[11px] uppercase tracking-[0.06em] text-gray-45">
                    Enviado
                  </span>
                ) : null}
                <span className="nota text-[11.5px] text-gray-45">
                  {n.destinatario}
                </span>
                <span className="nota text-[11.5px] text-gray-45">
                  {fechaHora(n.creadoEn)}
                </span>
              </button>

              {abierto && (
                <div className="border-t border-gray-20 bg-lienzo">
                  {n.errorEnvio && (
                    <div className="border-b border-gray-20 px-5 py-3 nota text-marca">
                      Resend rechazó el envío: {n.errorEnvio}
                    </div>
                  )}
                  <pre className="px-5 py-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap">
                    {n.cuerpo}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/**
 * Cuánto queda del plan gratuito de Resend.
 *
 * Está acá arriba y no escondido en ajustes porque el problema que resuelve es
 * enterarse tarde: cuando el cupo se llena, Resend deja de aceptar envíos y los
 * pagos se siguen registrando, pero las familias no reciben ni el comprobante ni
 * el aviso de que les falta plata. Eso se descubre cuando alguien reclama.
 *
 * Se ve en la pantalla donde ya se miran los correos, que es donde uno está
 * cuando la pregunta aparece.
 */
function UsoDeResend() {
  const { data } = api.notificacion.uso.useQuery(undefined, {
    // El número cambia de a poco: no tiene sentido pedirlo cada tres segundos
    // como la lista de al lado.
    refetchInterval: 60_000,
  });

  if (!data) return null;

  return (
    <div className="mb-8 border border-ink">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-20 px-5 py-3">
        <span className="font-rotulo text-[12px] tracking-[0.06em] uppercase">
          Plan de envío
        </span>
        {!data.enviando && (
          <span className="nota text-[11.5px] text-gray-45">
            El envío real está apagado: no se está gastando cupo.
          </span>
        )}
      </div>

      <div className="grid gap-px bg-gray-20 sm:grid-cols-2">
        <Medidor rotulo="Este mes" usado={data.mes} tope={data.limiteMes} />
        <Medidor rotulo="Hoy" usado={data.dia} tope={data.limiteDia} />
      </div>
    </div>
  );
}

/**
 * Un contador con su barra.
 *
 * La barra existe porque "412" no dice nada solo y "412 de 3.000" obliga a hacer
 * una división mental. El color aparece recién cuando importa: en el 75% avisa y
 * en el 90% alarma. Antes de eso es tinta, como todo el resto del panel — una
 * barra que siempre está pintada de algo deja de señalar.
 */
function Medidor({
  rotulo,
  usado,
  tope,
}: {
  rotulo: string;
  usado: number;
  tope: number;
}) {
  const parte = Math.min(usado / tope, 1);
  const apretado = parte >= 0.75;
  const critico = parte >= 0.9;

  return (
    <div className="bg-paper px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-rotulo text-[11px] tracking-[0.08em] text-gray-45 uppercase">
          {rotulo}
        </span>
        <span
          className={`font-mono text-[12px] ${critico ? "text-marca" : "text-gray-45"}`}
        >
          quedan {Math.max(tope - usado, 0)}
        </span>
      </div>

      <div className="mt-1.5 font-display text-[26px] leading-none tabular-nums">
        {usado.toLocaleString("es-AR")}
        <span className="text-[15px] text-gray-45">
          {" "}
          / {tope.toLocaleString("es-AR")}
        </span>
      </div>

      {/* Fondo gris con la parte usada en tinta. Un píxel de alto mínimo para
          que el primer envío del mes se vea en vez de dar una barra vacía. */}
      <div className="mt-3 h-1.5 w-full bg-gray-20">
        <div
          className={`h-full ${critico ? "bg-marca" : "bg-ink"}`}
          style={{ width: `${Math.max(parte * 100, usado > 0 ? 1 : 0)}%` }}
        />
      </div>

      {apretado && (
        <p className={`nota mt-2 ${critico ? "text-marca" : ""}`}>
          {critico
            ? "Casi sin cupo. Si se llena, los correos dejan de salir."
            : "Se está acercando al tope."}
        </p>
      )}
    </div>
  );
}

/**
 * Manda una muestra de una plantilla a un email, para ver cómo llega al inbox.
 *
 * Va por Resend directo, sin guardarse en la bandeja: es una prueba, no una
 * notificación. Si Resend no está configurado, el error lo dice.
 */
function ProbarPlantillas() {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<keyof typeof ROTULO>("RECORDATORIO");
  const [email, setEmail] = useState("");

  const enviar = api.notificacion.enviarPrueba.useMutation();

  return (
    <div className="mb-8 border border-ink">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-paper-dim"
      >
        <span className="flex items-center gap-2 font-rotulo text-[12px] uppercase tracking-[0.06em]">
          <IconoProbeta />
          Probar plantillas
        </span>
        <span className="font-rotulo text-[11px] uppercase tracking-[0.06em] text-gray-45">
          {abierto ? "Cerrar" : "Abrir"}
        </span>
      </button>

      {abierto && (
        <div className="border-t border-gray-20 p-5">
          <p className="nota mb-4 max-w-[62ch]">
            Elegí una plantilla y una casilla: te llega el mismo correo que
            recibiría una familia, con datos de ejemplo. No se guarda en la
            bandeja.
          </p>

          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Desplegable
              label="Plantilla"
              valor={tipo}
              alCambiar={(v) => setTipo(v as keyof typeof ROTULO)}
              opciones={Object.entries(ROTULO).map(([valor, etiqueta]) => ({
                valor,
                etiqueta,
              }))}
            />

            <Campo
              label="Mandar a"
              type="email"
              placeholder="vos@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Boton
              onClick={() => enviar.mutate({ tipo, email })}
              disabled={!email || enviar.isPending}
            >
              <IconoSobre />
              {enviar.isPending ? "Enviando…" : "Enviar prueba"}
            </Boton>
          </div>

          {enviar.isSuccess && (
            <p className="nota mt-4 border border-ink bg-paper-dim px-3.5 py-2.5 text-ink">
              Enviado a {email}. Revisá el inbox (y el spam, la primera vez).
            </p>
          )}
          {enviar.isError && (
            <p className="nota mt-4 border border-marca px-3.5 py-2.5 text-marca">
              {enviar.error.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
