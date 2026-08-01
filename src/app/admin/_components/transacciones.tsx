"use client";

import { useState } from "react";

import { Copiar } from "~/app/_components/copiar";
import {
  IconoAlerta,
  IconoBillete,
  IconoFlecha,
  IconoTilde,
} from "~/app/_components/iconos";
import { Boton, Campo, Dato, Encabezado, Tag, TiraDatos, Vacio } from "~/app/_components/ui";
import { fecha, fechaHora, pesos } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

type Fila = RouterOutputs["transaccion"]["listar"]["filas"][number];

const FILTROS = [
  { valor: "todo", etiqueta: "Todo" },
  { valor: "pagos", etiqueta: "Pagos" },
  { valor: "fallas", etiqueta: "Para mirar" },
] as const;

/** Los nombres internos, dichos en castellano. */
const RESULTADOS: Record<string, string> = {
  "cuota-saldada": "Cuota saldada",
  "pago-parcial": "Pago parcial",
  duplicado: "Aviso repetido",
  "customer-desconocido": "CVU que no reconocemos",
  "transaccion-no-encontrada": "El proveedor no la encontró",
  "cuenta-desconocida": "Cuenta de cobro desconocida",
  "pago-no-encontrado": "El pago no existe en el proveedor",
  "alumno-desconocido": "No se pudo identificar al alumno",
  "sin-referencia": "Vino sin referencia",
  "sin-credenciales": "Faltan credenciales",
  "estado-pendiente": "Pendiente en el proveedor",
  "estado-rechazado": "Rechazado",
};

const TIPOS: Record<string, string> = {
  "pago-registrado": "Pago acreditado",
  "aviso-recibido": "Aviso del proveedor",
  "cobro-iniciado": "Cobro iniciado",
  "aviso-rechazado": "Aviso rechazado",
};

/**
 * Todas las transacciones de la plataforma.
 *
 * Junta la plata que entró con los intentos que no llegaron a entrar: sin lo
 * segundo, un cobro que falla es invisible hasta que la familia reclama. Cada
 * fila se abre para mostrar el detalle completo.
 */
export function Transacciones() {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["valor"]>("todo");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(0);
  const limite = 50;

  const { data: resumen } = api.transaccion.resumen.useQuery();
  const { data, isLoading } = api.transaccion.listar.useQuery(
    { limite, desplazamiento: pagina * limite, filtro, busqueda },
    // Los pagos entran por webhook: la pantalla tiene que verlos llegar sola.
    { refetchInterval: 10_000 },
  );

  return (
    <>
      <Encabezado
        eyebrow="Cobros"
        titulo="Transacciones"
        bajada="Todo lo que pasó alrededor del dinero: lo que entró y lo que se intentó y no entró. Tocá una fila para ver el detalle."
      />

      <TiraDatos className="mb-8">
        <Dato
          rotulo="Recaudado"
          valor={pesos(resumen?.recaudado ?? 0)}
          icono={<IconoBillete />}
        />
        <Dato
          rotulo="Pagos acreditados"
          valor={resumen?.pagos ?? 0}
          icono={<IconoTilde />}
        />
        <Dato
          rotulo="Para mirar"
          valor={resumen?.fallas ?? 0}
          icono={<IconoAlerta />}
        />
      </TiraDatos>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="flex gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => {
                setFiltro(f.valor);
                setPagina(0);
              }}
              className={`border px-3.5 py-2 font-rotulo text-[11.5px] uppercase tracking-[0.06em] transition-colors ${
                filtro === f.valor
                  ? "border-ink bg-ink text-paper"
                  : "border-gray-20 text-gray-45 hover:border-ink hover:text-ink"
              }`}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>
        <Campo
          label="Buscar"
          placeholder="Alumno, grupo o id del pago"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPagina(0);
          }}
          className="min-w-[240px] flex-1"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse bg-paper-dim" />
          ))}
        </div>
      ) : !data || data.filas.length === 0 ? (
        <Vacio>
          {busqueda
            ? "Nada coincide con esa búsqueda"
            : filtro === "fallas"
              ? "No hay nada para mirar: ningún cobro falló"
              : "Todavía no hay movimientos"}
        </Vacio>
      ) : (
        <div className="border border-ink">
          {data.filas.map((f) => (
            <FilaTransaccion key={f.id} fila={f} />
          ))}
        </div>
      )}

      {data && (data.hayMas || pagina > 0) && (
        <div className="mt-6 flex items-center justify-between">
          <Boton
            variante="fantasma"
            onClick={() => setPagina((p) => Math.max(p - 1, 0))}
            disabled={pagina === 0}
          >
            Anteriores
          </Boton>
          <span className="font-rotulo text-[11.5px] uppercase tracking-[0.06em] text-gray-45">
            {pagina * limite + 1}–{pagina * limite + data.filas.length} de {data.total}
          </span>
          <Boton
            variante="fantasma"
            onClick={() => setPagina((p) => p + 1)}
            disabled={!data.hayMas}
          >
            Siguientes
          </Boton>
        </div>
      )}
    </>
  );
}

function FilaTransaccion({ fila }: { fila: Fila }) {
  const [abierto, setAbierto] = useState(false);
  const esPago = fila.clase === "pago";

  return (
    <div className="border-b border-gray-20 last:border-b-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-left transition-colors hover:bg-paper-dim"
      >
        <IconoFlecha
          className="chevron-transaccion h-3 w-3 shrink-0 text-gray-45"
          data-abierto={abierto}
        />

        <div className="min-w-[132px] font-mono text-[11.5px] text-gray-45">
          {fechaHora(fila.fecha)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px]">
              {fila.alumno ?? "Sin alumno identificado"}
            </span>
            {fila.falla && <Tag>Para mirar</Tag>}
            {!esPago && !fila.falla && <Tag>Aviso</Tag>}
          </div>
          <div className="mt-0.5 font-rotulo text-[11px] uppercase tracking-[0.06em] text-gray-45">
            {fila.grupo ?? "—"} · {fila.proveedor === "TALO" ? "Talo" : "Mercado Pago"}
            {fila.resultado && ` · ${RESULTADOS[fila.resultado] ?? fila.resultado}`}
          </div>
        </div>

        <div
          className={`font-mono text-[13.5px] whitespace-nowrap ${
            esPago ? "" : "text-gray-45"
          }`}
        >
          {fila.monto === null ? "—" : pesos(fila.monto)}
        </div>
      </button>

      {/* El detalle. Se mantiene montado para que la animación tenga desde y
          hasta dónde ir; el `data-abierto` es lo que la dispara. */}
      <div className="detalle-despliegue" data-abierto={abierto}>
        <div>
          <div className="border-t border-gray-20 bg-paper-dim px-5 py-4">
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <Detalle rotulo="Qué pasó" valor={TIPOS[fila.tipo] ?? fila.tipo} />
              <Detalle
                rotulo="Resultado"
                valor={
                  fila.resultado
                    ? (RESULTADOS[fila.resultado] ?? fila.resultado)
                    : "Acreditado"
                }
              />
              <Detalle
                rotulo="Proveedor"
                valor={fila.proveedor === "TALO" ? "Talo" : "Mercado Pago"}
              />
              <Detalle rotulo="Cuenta que cobra" valor={fila.cuenta ?? "La de por defecto"} />
              {fila.cuota !== null && (
                <Detalle rotulo="Imputado a" valor={`Cuota ${fila.cuota}`} />
              )}
              <Detalle rotulo="Fecha" valor={fecha(fila.fecha)} />
            </div>

            {fila.refPago && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-gray-20 bg-paper px-3 py-2.5">
                <div className="min-w-0">
                  <div className="font-rotulo text-[10.5px] uppercase tracking-[0.06em] text-gray-45">
                    Id en el proveedor
                  </div>
                  <div className="font-mono text-[11.5px] break-all">
                    {fila.refPago}
                  </div>
                </div>
                <Copiar valor={fila.refPago} etiqueta="Copiar" />
              </div>
            )}

            {fila.detalle && (
              <p className="nota mt-3 text-[12.5px]">{fila.detalle}</p>
            )}

            {fila.grupoId && (
              <a
                href={`/admin/grupos/${fila.grupoId}`}
                className="mt-4 inline-block font-rotulo text-[11.5px] uppercase tracking-[0.05em] underline underline-offset-2 hover:text-gray-70"
              >
                Ver el grupo
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Detalle({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div className="font-rotulo text-[10.5px] uppercase tracking-[0.06em] text-gray-45">
        {rotulo}
      </div>
      <div className="mt-0.5 text-[13.5px]">{valor}</div>
    </div>
  );
}
