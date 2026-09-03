import { fecha, pesos } from "~/lib/format";
import { Marca } from "./marca";

export type CuotaVista = {
  id: string;
  numero: number;
  monto: number;
  venceEl: Date;
  recargo: number;
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
 * La clase de fondo por estado. Verde saldado, rojo vencido, y la pendiente sin
 * tocar —queda en el neutro del papel—: si todo tuviera color, el color dejaría
 * de señalar nada. Las clases viven en `globals.css` para dar vuelta con el
 * tema.
 */
export const FONDO_ESTADO = {
  PAGADA: "fila-pagada",
  VENCIDA: "fila-vencida",
  PENDIENTE: "",
} as const;

/**
 * Un rótulo con nombre y color por estado.
 *
 * Los tintes de fondo ya decían lo mismo, pero decían poco: son a propósito
 * tenues para que la fila se siga leyendo en blanco y negro, y en el tema
 * oscuro un tinte al trece por ciento es casi nada. Halley pidió que el estado
 * se vea, y un rótulo con la palabra y el color lo dice sin depender de que el
 * ojo distinga un fondo apenas verdoso de uno apenas rojizo.
 *
 * La pendiente va en gris y no sin rótulo: si sólo dos estados llevaran
 * etiqueta, la fila sin etiqueta se leería como "falta información" y no
 * como "todavía no vence".
 */
const ROTULO_ESTADO = {
  PAGADA: { texto: "Pagada", clase: "border-ok text-ok" },
  VENCIDA: { texto: "Vencida", clase: "border-marca text-marca" },
  PENDIENTE: { texto: "Pendiente", clase: "border-gray-45 text-gray-45" },
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
              FONDO_ESTADO[cuota.estado] || (esProxima ? "bg-paper-dim" : "")
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

            <span className="w-14 shrink-0 font-rotulo text-[12px] tracking-[0.06em] text-gray-45">
              CUOTA {String(cuota.numero).padStart(2, "0")}
            </span>

            <span className="flex-1 font-mono text-[13px]">
              {pesos(cuota.monto)}
              {cuota.recargo > 0 && (
                <span className="ml-2 text-[10.5px] text-marca">
                  + {pesos(cuota.recargo)} de recargo
                </span>
              )}
              {cuota.estado !== "PAGADA" && cuota.aplicado > 0 && (
                <span className="ml-2 text-[10.5px] text-gray-45">
                  pagado {pesos(cuota.aplicado)} · falta {pesos(cuota.saldo)}
                </span>
              )}
            </span>

            <span className="flex shrink-0 items-center gap-2.5">
              <span
                className={`border px-1.5 py-0.5 font-rotulo text-[10px] uppercase tracking-[0.08em] ${ROTULO_ESTADO[cuota.estado].clase}`}
              >
                {ROTULO_ESTADO[cuota.estado].texto}
              </span>
              <span className="text-right font-rotulo text-[11.5px] uppercase tracking-[0.06em] text-gray-70">
                {/* El rótulo ya dice el estado; acá queda sólo la fecha, con el
                    verbo que corresponde. Una pagada no necesita fecha de
                    vencimiento: ya no vence. */}
                {cuota.estado === "PAGADA"
                  ? fecha(cuota.venceEl)
                  : `${cuota.estado === "VENCIDA" ? "Venció" : "Vence"} ${fecha(cuota.venceEl)}`}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
