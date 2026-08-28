"use client";

import { useEffect, useState } from "react";

import { Modal } from "~/app/_components/modal";
import { Boton, BotonTexto, Campo, Tag } from "~/app/_components/ui";
import { fecha, pesos } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * Los montos del plan: el del grupo y el de cada familia.
 *
 * El plan vive en el grupo, pero adentro de un mismo curso los precios no son
 * todos iguales: se negocian por familia. Son dos pantallas porque son dos
 * decisiones distintas —"cuánto sale este curso" y "cuánto arregló esta
 * familia"— y mezclarlas invita a cambiarle el precio a los cuarenta creyendo
 * que se le cambia a uno.
 *
 * Lo que se guarda del lado del alumno es sólo la diferencia. Si no hay
 * acuerdo propio no hay fila, así que cambiar el precio general sigue
 * arrastrando a todos los que están en él y no pisa a los que no.
 *
 * La seña, donde la haya, es la cuota 1 con su propio monto. No es una clase
 * aparte y por eso no tiene su propia caja: se edita como cualquier otra.
 */

/* ------------------------------------------------------------- utilidades */

/** Lo que se tipea es un número suelto; los puntos y el signo los pone la vista. */
function aNumero(texto: string) {
  return Math.max(0, Math.round(Number(texto.replace(/\D/g, "")) || 0));
}

/* ------------------------------------------------------- montos del grupo */

type CuotaGrupo = {
  id: string;
  numero: number;
  monto: number;
  venceEl: Date;
};

/**
 * El precio del curso. Toca las cuotas del grupo, así que le cambia el monto a
 * todos los que no tengan acuerdo propio — y a nadie más.
 */
export function MontosDelGrupo({
  abierto,
  alCerrar,
  cuotas,
  conPrecioPropio,
  alRefrescar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  cuotas: CuotaGrupo[];
  /** Cuántos alumnos no se ven afectados, para decirlo antes y no después. */
  conPrecioPropio: number;
  alRefrescar: () => Promise<void>;
}) {
  return (
    <Modal abierto={abierto} alCerrar={alCerrar} titulo="Montos del plan">
      <p className="nota mb-5 max-w-[62ch]">
        El precio del curso. Se guarda cuota por cuota.
        {conPrecioPropio > 0 && (
          <>
            {" "}
            <strong className="font-normal text-ink">
              {conPrecioPropio}{" "}
              {conPrecioPropio === 1 ? "alumno tiene" : "alumnos tienen"} precio
              propio
            </strong>{" "}
            y no se {conPrecioPropio === 1 ? "ve afectado" : "ven afectados"} por
            lo que cambies acá.
          </>
        )}
      </p>

      <div className="border border-ink">
        {cuotas.map((c) => (
          <FilaGrupo key={c.id} cuota={c} alRefrescar={alRefrescar} />
        ))}
      </div>
    </Modal>
  );
}

function FilaGrupo({
  cuota,
  alRefrescar,
}: {
  cuota: CuotaGrupo;
  alRefrescar: () => Promise<void>;
}) {
  const [monto, setMonto] = useState(String(cuota.monto));
  useEffect(() => setMonto(String(cuota.monto)), [cuota.monto]);

  const guardar = api.grupo.actualizarCuota.useMutation({
    onSuccess: () => alRefrescar(),
  });

  const valor = aNumero(monto);
  const sucio = valor !== cuota.monto && valor > 0;

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-gray-20 px-4 py-3 last:border-b-0">
      <div className="w-20 shrink-0">
        <div className="font-rotulo text-[11.5px] tracking-[0.06em] text-gray-45 uppercase">
          Cuota {String(cuota.numero).padStart(2, "0")}
        </div>
        <div className="nota text-[11px]">{fecha(cuota.venceEl)}</div>
      </div>

      <Campo
        label="Monto"
        className="min-w-[140px] flex-1"
        inputMode="numeric"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
        hint={valor > 0 ? pesos(valor) : "Sólo números."}
      />

      <Boton
        onClick={() => guardar.mutate({ cuotaId: cuota.id, monto: valor })}
        disabled={!sucio || guardar.isPending}
      >
        {guardar.isPending ? "Guardando…" : "Guardar"}
      </Boton>
    </div>
  );
}

/* ------------------------------------------------------ precio del alumno */

type CuotaAlumno = {
  id: string;
  numero: number;
  /** El monto que le toca hoy: el propio si lo tiene, el del grupo si no. */
  monto: number;
  venceEl: Date;
};

/**
 * El precio de una familia.
 *
 * Arranca por el atajo —todas las cuotas al mismo monto— porque es el caso
 * real: se negocia un número por cuota, no trece por separado. La edición fina
 * queda abajo para la seña, que casi siempre vale distinto, y para el que
 * arregló algo raro.
 */
export function PrecioDelAlumno({
  alumnoId,
  cuotas,
  ajustes,
  alRefrescar,
}: {
  alumnoId: string;
  cuotas: CuotaAlumno[];
  /** Las cuotas con acuerdo propio, para distinguirlas del precio del grupo. */
  ajustes: { cuotaId: string; monto: number | null; venceEl: Date | null }[];
  alRefrescar: (mensaje?: string) => Promise<void>;
}) {
  const [parejo, setParejo] = useState("");
  const [abierto, setAbierto] = useState(false);

  const propios = new Map(ajustes.map((a) => [a.cuotaId, a]));

  const igualar = api.grupo.ajustarPlanAlumno.useMutation({
    onSuccess: async (r) => {
      setParejo("");
      await alRefrescar(`Quedaron ${r.cuotas} cuotas a ese monto.`);
    },
  });

  const valorParejo = aNumero(parejo);

  return (
    <div>
      <p className="nota mb-3 max-w-[62ch]">
        Lo que arregló esta familia. Lo que no tenga monto propio sigue el
        precio del curso, y cambiarlo allá lo arrastra.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <Campo
          label="Todas las cuotas a"
          className="min-w-[150px] flex-1"
          inputMode="numeric"
          placeholder="45000"
          value={parejo}
          onChange={(e) => setParejo(e.target.value)}
          hint={valorParejo > 0 ? pesos(valorParejo) : "Sólo números."}
        />
        <Boton
          onClick={() =>
            igualar.mutate({ alumnoId, montoPorCuota: valorParejo })
          }
          disabled={valorParejo <= 0 || igualar.isPending}
        >
          {igualar.isPending ? "Aplicando…" : "Aplicar a todas"}
        </Boton>
      </div>

      <div className="mt-4">
        <BotonTexto onClick={() => setAbierto((v) => !v)}>
          {abierto ? "Ocultar el detalle" : "Editar cuota por cuota"}
        </BotonTexto>
      </div>

      {abierto && (
        <div className="mt-3 border border-gray-20">
          {cuotas.map((c) => (
            <FilaAlumno
              key={c.id}
              alumnoId={alumnoId}
              cuota={c}
              propio={propios.get(c.id) ?? null}
              alRefrescar={alRefrescar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilaAlumno({
  alumnoId,
  cuota,
  propio,
  alRefrescar,
}: {
  alumnoId: string;
  cuota: CuotaAlumno;
  propio: { monto: number | null; venceEl: Date | null } | null;
  alRefrescar: (mensaje?: string) => Promise<void>;
}) {
  const [monto, setMonto] = useState(String(cuota.monto));
  useEffect(() => setMonto(String(cuota.monto)), [cuota.monto]);

  const ajustar = api.grupo.ajustarCuotaAlumno.useMutation({
    onSuccess: () => alRefrescar(),
  });

  const valor = aNumero(monto);
  const sucio = valor !== cuota.monto && valor > 0;

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-gray-20 px-3.5 py-3 last:border-b-0">
      <div className="w-24 shrink-0">
        <div className="font-rotulo text-[11px] tracking-[0.06em] text-gray-45 uppercase">
          Cuota {String(cuota.numero).padStart(2, "0")}
        </div>
        <div className="nota text-[10.5px]">{fecha(cuota.venceEl)}</div>
        {propio && (
          <div className="mt-1">
            <Tag activo>Propio</Tag>
          </div>
        )}
      </div>

      <Campo
        label="Monto"
        className="min-w-[130px] flex-1"
        inputMode="numeric"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
        hint={valor > 0 ? pesos(valor) : "Sólo números."}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Boton
          onClick={() =>
            ajustar.mutate({
              alumnoId,
              cuotaId: cuota.id,
              monto: valor,
              venceEl: propio?.venceEl ?? null,
            })
          }
          disabled={!sucio || ajustar.isPending}
        >
          Guardar
        </Boton>

        {/* Volver al precio del curso es borrar el acuerdo, no copiarle el
            número del grupo encima: si mañana cambia el general, esta familia
            tiene que moverse con él. */}
        {propio && (
          <BotonTexto
            onClick={() =>
              ajustar.mutate({
                alumnoId,
                cuotaId: cuota.id,
                monto: null,
                venceEl: null,
              })
            }
            disabled={ajustar.isPending}
          >
            Volver al del curso
          </BotonTexto>
        )}
      </div>
    </div>
  );
}

