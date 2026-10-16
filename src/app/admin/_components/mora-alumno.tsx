"use client";

import { useState } from "react";

import type { CuotaVista } from "~/app/_components/plan-cuotas";
import { fecha, pesos } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * La mora de una familia, cuota por cuota, con un interruptor para perdonarla.
 *
 * Hasta acá la mora se perdonaba en dos lugares y ninguno servía para el caso
 * real: al dar de alta, que es antes de que exista el problema, y al marcar
 * una cuota como paga, que registra un pago que todavía no entró. El caso real
 * es el del medio: la familia avisa que va a pagar tarde, Halley acuerda no
 * cobrarle el recargo, y la cuota sigue impaga hasta que paguen por el link.
 *
 * Es un interruptor y no un formulario porque la decisión es binaria y por
 * cuota. Y muestra el número de la mora en cada fila, porque la pregunta que
 * trae a alguien acá es "cuánto le estoy perdonando", y una cuota vencida hace
 * diez días debe cero: sin decir cuándo y a cuánto salta, el cero parece un
 * error. Lo que se perdona hoy es casi siempre una mora que todavía no empezó.
 *
 * Perdonar no registra ningún pago. Para "pagó por fuera y no le cobro la
 * mora" sigue estando Marcar pagas con la casilla destildada.
 */

export type CuotaConMora = CuotaVista & {
  /** El capital que falta de la cuota, sin el recargo. */
  saldoSinMora: number;
  /**
   * Cuándo da el próximo salto la mora de esta cuota y a cuánto. Nulo si no
   * va a saltar: paga, perdonada, o con el capital cubierto y la mora fijada.
   */
  moraQueViene: { desde: Date; recargo: number } | null;
};

export function MoraDelAlumno({
  alumnoId,
  cuotas,
  ajustes,
  alRefrescar,
}: {
  alumnoId: string;
  cuotas: CuotaConMora[];
  ajustes: { cuotaId: string; sinMora: boolean }[];
  alRefrescar: (mensaje?: string) => Promise<void>;
}) {
  const perdonadas = new Set(
    ajustes.filter((a) => a.sinMora).map((a) => a.cuotaId),
  );
  /** La cuota cuyo interruptor está viajando al servidor. */
  const [cambiando, setCambiando] = useState<string | null>(null);

  const cambiar = api.alumno.perdonDeMora.useMutation({
    onSuccess: async (r) => {
      await alRefrescar(
        r.perdonada
          ? "Mora perdonada. Esa cuota no suma recargo."
          : "La mora de esa cuota vuelve a correr.",
      );
      setCambiando(null);
    },
    onError: () => setCambiando(null),
  });

  // Lo que debe de mora hoy, sumado: es el número que faltaba en el panel.
  const moraHoy = cuotas.reduce(
    (t, c) =>
      t + (c.estado === "PAGADA" ? 0 : Math.max(c.saldo - c.saldoSinMora, 0)),
    0,
  );
  const cuantasPerdonadas = cuotas.filter((c) => perdonadas.has(c.id)).length;

  return (
    <div>
      <p className="nota mb-3 max-w-[62ch]">
        <strong className="text-ink">
          {moraHoy > 0
            ? `Hoy debe ${pesos(moraHoy)} de mora.`
            : "Hoy no debe mora."}
        </strong>{" "}
        {cuantasPerdonadas > 0 &&
          `${
            cuantasPerdonadas === 1
              ? "Una cuota perdonada"
              : `${cuantasPerdonadas} cuotas perdonadas`
          }. `}
        La mora corre por mes entero cumplido: 3% al primer mes y compuesto
        después. Perdonarla vale aunque todavía no haya empezado a correr, y se
        puede volver atrás mientras la cuota no esté paga.
      </p>

      <div className="border border-gray-20">
        {cuotas.map((c) => (
          <FilaMora
            key={c.id}
            cuota={c}
            perdonada={perdonadas.has(c.id)}
            ocupada={cambiando !== null}
            alCambiar={(perdonar) => {
              setCambiando(c.id);
              cambiar.mutate({ alumnoId, cuotaId: c.id, perdonar });
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Lo que hay que saber de la mora de esta cuota, en una frase. */
function describir(cuota: CuotaConMora, perdonada: boolean) {
  const pendiente = Math.max(cuota.saldo - cuota.saldoSinMora, 0);
  const capitalCubierto = cuota.saldoSinMora <= 0.01;
  const viene = cuota.moraQueViene;

  if (cuota.estado === "PAGADA") {
    return perdonada
      ? "Pagada sin recargo: la mora estaba perdonada."
      : "Pagada. No hay mora que perdonar.";
  }
  if (perdonada) return "Perdonada: no suma recargo, pase el tiempo que pase.";
  if (capitalCubierto) {
    return `Pagó el capital y le queda ${pesos(pendiente)} de mora, fijada el día que pagó. Ya no crece.`;
  }
  if (pendiente > 0) {
    return (
      `Hoy suma ${pesos(pendiente)} de mora` +
      (viene
        ? `; desde el ${fecha(viene.desde)} pasa a ${pesos(viene.recargo)}.`
        : ".")
    );
  }
  if (viene) {
    return cuota.estado === "VENCIDA"
      ? `Venció y todavía no suma recargo. Desde el ${fecha(viene.desde)} debe ${pesos(viene.recargo)} de mora.`
      : `Todavía no vence. Sin recargo hasta el ${fecha(viene.desde)}; ahí sumaría ${pesos(viene.recargo)}.`;
  }
  return "Sin recargo.";
}

function FilaMora({
  cuota,
  perdonada,
  ocupada,
  alCambiar,
}: {
  cuota: CuotaConMora;
  perdonada: boolean;
  /** Hay otro interruptor viajando: se espera a que vuelva antes de tocar éste. */
  ocupada: boolean;
  alCambiar: (perdonar: boolean) => void;
}) {
  const pagada = cuota.estado === "PAGADA";

  return (
    <div
      data-cuota={cuota.numero}
      className={`flex flex-wrap items-center gap-3 border-b border-gray-20 px-3.5 py-3 last:border-b-0 ${
        pagada ? "text-gray-45" : ""
      }`}
    >
      <div className="w-24 shrink-0">
        <div
          className={`font-rotulo text-[11px] tracking-[0.06em] uppercase ${
            pagada ? "text-gray-45" : "text-gray-70"
          }`}
        >
          Cuota {String(cuota.numero).padStart(2, "0")}
        </div>
        <div className="nota text-[10.5px]">
          {cuota.estado === "VENCIDA" ? "venció" : "vence"}{" "}
          {fecha(cuota.venceEl)}
        </div>
      </div>

      <div className="min-w-0 flex-1 text-[12.5px] leading-snug">
        {describir(cuota, perdonada)}
      </div>

      {/* Una paga no tiene interruptor: perdonarle la mora después de cobrada
          no es perdonar, es devolver, y eso se decide mirando los pagos. */}
      {!pagada && (
        <label className="flex shrink-0 cursor-pointer items-center gap-2 font-rotulo text-[11px] tracking-[0.06em] uppercase">
          <input
            type="checkbox"
            checked={perdonada}
            disabled={ocupada}
            onChange={(e) => alCambiar(e.target.checked)}
            className="h-4 w-4 shrink-0 accent-[var(--color-ink)]"
          />
          {perdonada ? "Perdonada" : "Perdonar"}
        </label>
      )}
    </div>
  );
}
