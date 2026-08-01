"use client";

import { useState } from "react";

import { IconoCopiar, IconoTilde } from "./iconos";

/**
 * Los datos para transferir: alias y CVU.
 *
 * Reemplaza al QR, que prometía algo que no cumplía —era texto plano, ninguna
 * app de pagos podía leerlo—. Acá el camino real es copiar y pegar, así que la
 * pantalla lo dice y lo hace fácil: el campo entero es el botón, no un ícono
 * chiquito al costado.
 *
 * El alias va primero y más grande porque es lo que la gente usa; el CVU queda
 * abajo para el banco que todavía lo pide.
 */
export function DatosTransferencia({
  alias,
  cvu,
}: {
  alias: string;
  cvu: string;
}) {
  return (
    <div className="mt-6">
      <div className="border border-ink">
        <div className="border-b border-gray-20 bg-paper-dim px-4 py-2.5">
          <div className="font-rotulo text-[11px] uppercase tracking-[0.1em] text-gray-70">
            Transferí desde tu banco o billetera
          </div>
        </div>

        <CampoCopiable rotulo="Alias" valor={alias} destacado />
        <CampoCopiable rotulo="CVU" valor={cvu} />
      </div>

      <p className="nota mt-3 text-[12px]">
        Buscá <strong className="font-semibold">Transferir</strong> en tu banco,
        pegá el alias y confirmá. Cuando el dinero llegue, lo vas a ver acá.
      </p>
    </div>
  );
}

/**
 * Un dato que se copia tocándolo.
 *
 * Todo el bloque es el botón. Un ícono de copiar al costado se ve como
 * decoración y la mitad de la gente termina seleccionando el texto a mano —que
 * en el teléfono, con un CVU de veintidós dígitos, es una pelea.
 */
function CampoCopiable({
  rotulo,
  valor,
  destacado = false,
}: {
  rotulo: string;
  valor: string;
  destacado?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
    } catch {
      // Sin permiso de portapapeles (http, iframe): el camino viejo.
      const ta = document.createElement("textarea");
      ta.value = valor;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={`Copiar ${rotulo}: ${valor}`}
      className="flex w-full items-center justify-between gap-3 border-b border-gray-20 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-paper-dim"
    >
      <span className="min-w-0">
        <span className="block font-rotulo text-[10.5px] uppercase tracking-[0.08em] text-gray-45">
          {rotulo}
        </span>
        <span
          className={`mt-0.5 block font-mono break-all ${
            destacado ? "text-[16px]" : "text-[13px] text-gray-70"
          }`}
        >
          {valor}
        </span>
      </span>

      <span
        className={`inline-flex shrink-0 items-center gap-1.5 font-rotulo text-[11px] uppercase tracking-[0.06em] ${
          copiado ? "text-ink" : "text-gray-45"
        }`}
      >
        {copiado ? <IconoTilde /> : <IconoCopiar />}
        {copiado ? "Copiado" : "Copiar"}
      </span>
    </button>
  );
}
