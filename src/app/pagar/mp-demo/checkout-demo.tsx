"use client";

import { useState } from "react";

import { pesos } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * El checkout demo. Imita lo justo de Mercado Pago —el monto, un botón para
 * pagar, otro para volver— sin fingir su marca. Al confirmar, dispara el webhook
 * y vuelve a la pantalla de pago, que detecta la acreditación sola.
 */
export function CheckoutDemo({
  pagoId,
  monto,
  yaAprobado,
  volver,
}: {
  pagoId: string;
  monto: number;
  yaAprobado: boolean;
  volver: string;
}) {
  const [pagando, setPagando] = useState(false);

  const confirmar = api.pago.confirmarPagoDemoMp.useMutation({
    onSuccess: () => {
      // Vuelve a donde volvería Mercado Pago. La pantalla de pago se encarga del
      // resto: espera la acreditación y festeja.
      window.location.href = volver;
    },
    onError: () => setPagando(false),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#ececec] px-4 py-10 text-[#333]">
      <div className="w-full max-w-[400px] overflow-hidden rounded-xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.12)]">
        <div className="flex items-center gap-2 bg-[#009ee3] px-6 py-4 text-white">
          <span className="text-[15px] font-semibold tracking-tight">
            Pago seguro
          </span>
          <span className="ml-auto rounded bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            Demo
          </span>
        </div>

        <div className="px-6 py-7">
          <p className="text-[13px] text-[#737373]">Total a pagar</p>
          <div className="mt-1 text-[34px] font-bold leading-none text-[#009ee3]">
            {pesos(monto)}
          </div>

          <p className="mt-5 text-[12.5px] leading-relaxed text-[#737373]">
            Esta pantalla reemplaza a Mercado Pago mientras el cobro está en modo
            demo. Con la cuenta real del socio conectada, acá aparece el checkout
            de Mercado Pago con sus medios de pago.
          </p>

          {yaAprobado ? (
            <div className="mt-6 rounded-lg bg-[#f0faf3] px-4 py-3 text-[13px] font-medium text-[#0a7c39]">
              Este pago ya fue confirmado.
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setPagando(true);
                confirmar.mutate({ pagoId });
              }}
              disabled={pagando}
              className="mt-6 w-full rounded-lg bg-[#009ee3] py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pagando ? "Procesando…" : "Pagar"}
            </button>
          )}

          <a
            href={volver}
            className="mt-3 block w-full rounded-lg py-3 text-center text-[14px] font-medium text-[#009ee3] hover:underline"
          >
            {yaAprobado ? "Volver" : "Cancelar"}
          </a>
        </div>
      </div>
    </div>
  );
}
