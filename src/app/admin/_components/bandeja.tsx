"use client";

import { useState } from "react";

import { Ayuda } from "~/app/_components/ayuda";
import { IconoProbeta, IconoSobre } from "~/app/_components/iconos";
import { Boton, Campo, Encabezado, Tag, Vacio } from "~/app/_components/ui";
import { fechaHora } from "~/lib/format";
import { api } from "~/trpc/react";
import { EsqueletoBandeja } from "./esqueletos";

const ROTULO = {
  INVITACION: "Invitación",
  ACCESO: "Link de acceso",
  CONFIRMACION_PADRE: "Confirmación",
  AVISO_ADMIN: "Aviso a Halley",
  RECORDATORIO: "Recordatorio",
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
      />

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
            <label className="flex flex-col gap-1.5">
              <span className="font-rotulo text-[10.5px] uppercase tracking-[0.06em] text-gray-70">
                Plantilla
              </span>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as keyof typeof ROTULO)}
                className="border border-ink bg-lienzo px-3 py-[11px] text-[14px]"
              >
                {Object.entries(ROTULO).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </label>

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
