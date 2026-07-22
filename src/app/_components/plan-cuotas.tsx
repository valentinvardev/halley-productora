import { fecha, pesos } from "~/lib/format";
import { Marca } from "./marca";

export type CuotaVista = {
  id: string;
  numero: number;
  monto: number;
  venceEl: Date;
  aplicado: number;
  saldo: number;
  estado: "PENDIENTE" | "PAGADA" | "VENCIDA";
};

/** Una marca de lápiz graso por estado. Compartida con el modal de cuotas. */
export const MARCA_ESTADO = {
  PAGADA: { tipo: "confirmado", color: "var(--color-ink)" },
  PENDIENTE: { tipo: "punteado", color: "var(--color-gray-45)" },
  VENCIDA: { tipo: "tachado", color: "var(--color-ink)" },
} as const;

/**
 * El plan completo, de la primera cuota a la última. Es el "de principio a
 * fin": la familia ve lo que pagó, lo que debe y lo que le falta, sin tener que
 * preguntar.
 */
export function PlanCuotas({
  cuotas,
  destacar,
}: {
  cuotas: CuotaVista[];
  /** Cuota a resaltar: la que hay que pagar ahora. */
  destacar?: string | null;
}) {
  return (
    <div className="border border-ink">
      {cuotas.map((cuota) => {
        const marca = MARCA_ESTADO[cuota.estado];
        const esProxima = destacar === cuota.id;

        return (
          <div
            key={cuota.id}
            className={`flex items-center gap-4 border-b border-gray-20 px-4 py-3 last:border-b-0 ${
              esProxima ? "bg-paper-dim" : ""
            }`}
          >
            <span className="h-6 w-6 shrink-0">
              <Marca
                tipo={marca.tipo}
                color={marca.color}
                className="h-full w-full"
                grosor={cuota.estado === "PAGADA" ? 3.5 : 4}
              />
            </span>

            <span className="w-14 shrink-0 font-mono text-[11px] tracking-[0.06em] text-gray-45">
              CUOTA {String(cuota.numero).padStart(2, "0")}
            </span>

            <span className="flex-1 font-mono text-[13px]">
              {pesos(cuota.monto)}
              {cuota.estado !== "PAGADA" && cuota.aplicado > 0 && (
                <span className="ml-2 text-[10.5px] text-gray-45">
                  pagado {pesos(cuota.aplicado)} · falta {pesos(cuota.saldo)}
                </span>
              )}
            </span>

            <span className="shrink-0 text-right font-mono text-[10.5px] uppercase tracking-[0.06em] text-gray-70">
              {cuota.estado === "PAGADA"
                ? "Pagada"
                : `${cuota.estado === "VENCIDA" ? "Venció" : "Vence"} ${fecha(cuota.venceEl)}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
