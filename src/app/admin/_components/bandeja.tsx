"use client";

import { useState } from "react";

import { Encabezado, Tag, Vacio } from "~/app/_components/ui";
import { fechaHora } from "~/lib/format";
import { api } from "~/trpc/react";

const ROTULO = {
  INVITACION: "Invitación",
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

      {isLoading && <Vacio>Cargando…</Vacio>}
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
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.06em] text-marca"
                    title={n.errorEnvio}
                  >
                    Falló el envío
                  </span>
                ) : n.enviadoEl ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-gray-45">
                    Enviado
                  </span>
                ) : null}
                <span className="font-mono text-[10.5px] text-gray-45">
                  {n.destinatario}
                </span>
                <span className="font-mono text-[10.5px] text-gray-45">
                  {fechaHora(n.creadoEn)}
                </span>
              </button>

              {abierto && (
                <div className="border-t border-gray-20 bg-lienzo">
                  {n.errorEnvio && (
                    <div className="border-b border-gray-20 px-5 py-3 font-mono text-[11px] text-marca">
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
