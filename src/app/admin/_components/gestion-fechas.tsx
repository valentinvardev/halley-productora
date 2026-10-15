"use client";

import { useEffect, useMemo, useState } from "react";

import { CampoFecha, aTexto } from "~/app/_components/campo-fecha";
import { IconoAlerta, IconoCalendario } from "~/app/_components/iconos";
import { Modal } from "~/app/_components/modal";
import { Boton, BotonTexto, Campo, Etiqueta, Tag } from "~/app/_components/ui";
import { fecha, pesos } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * Gestión de fechas: los vencimientos de las cuotas del curso, todos juntos.
 *
 * Es del curso y no de un alumno: les cambia la fecha a todos salvo a los que
 * tengan fecha propia en esa cuota. Por eso vive aparte de Gestión de cuotas,
 * que aplica a los tildados, y aparte de Montos del plan, que guarda de a una:
 * correr un plan entero un mes son trece ediciones, y acá es una.
 *
 * Lo que hace distinta a una fecha de un monto es la mora. El estado de cada
 * cuota no se guarda: se deriva de lo pagado y de cuánto tiempo pasó desde el
 * vencimiento, así que mover una fecha para adelante le borra recargo a todo
 * el curso en el acto, y moverla para atrás se lo crea. Ese número no lo
 * calcula nadie de cabeza, y por eso guardar pasa por una vista previa que lo
 * dice con familias y pesos antes de escribir.
 *
 * La línea de tiempo de arriba existe porque es lo que no se ve en ningún
 * lado: si las cuotas están parejas, si hay un hueco, si una quedó fuera de
 * orden. Al editar, la marca se mueve y deja la vieja en hueco.
 */

export type CuotaFechas = {
  id: string;
  numero: number;
  monto: number;
  venceEl: Date;
  /** Familias con esta cuota vencida hoy. */
  vencidas: number;
  /** Alumnos con fecha propia en esta cuota: no cambian. */
  conFechaPropia: number;
};

/* ------------------------------------------------------------- fechas */

/** De "AAAA-MM-DD" a un Date al mediodía local: en UTC no corre al día anterior. */
function deTexto(texto: string) {
  return new Date(`${texto}T12:00:00`);
}

/** El mismo día del mes, N meses después (o antes), sin pasarse de fin de mes. */
function sumarMeses(d: Date, meses: number) {
  const dia = d.getDate();
  const primero = new Date(d.getFullYear(), d.getMonth() + meses, 1, 12);
  const ultimo = new Date(primero.getFullYear(), primero.getMonth() + 1, 0).getDate();
  primero.setDate(Math.min(dia, ultimo));
  return primero;
}

/** El mismo mes con otro día, sin pasarse de fin de mes. */
function conDia(d: Date, dia: number) {
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth(), Math.min(dia, ultimo), 12);
}

function inicioDeHoy() {
  const h = new Date();
  return new Date(h.getFullYear(), h.getMonth(), h.getDate());
}

const mesCorto = new Intl.DateTimeFormat("es-AR", { month: "short" });

/* ------------------------------------------------------ línea de tiempo */

/**
 * Una franja de meses con una marca por cuota. Los meses van anchos según sus
 * días, así una fecha cae donde cae y no en una grilla aproximada.
 */
function LineaDeTiempo({
  cuotas,
  fechas,
}: {
  cuotas: CuotaFechas[];
  fechas: Record<string, string>;
}) {
  const todas = cuotas.flatMap((c) => [
    c.venceEl,
    fechas[c.id] ? deTexto(fechas[c.id]!) : c.venceEl,
  ]);
  const hoy = inicioDeHoy();
  const minimo = new Date(Math.min(...todas.map((d) => d.getTime()), hoy.getTime()));
  const maximo = new Date(Math.max(...todas.map((d) => d.getTime()), hoy.getTime()));
  // Un mes de aire a cada lado para que la primera y la última no queden
  // pegadas al borde.
  const inicio = new Date(minimo.getFullYear(), minimo.getMonth() - 1, 1);
  const fin = new Date(maximo.getFullYear(), maximo.getMonth() + 2, 1);
  const total = fin.getTime() - inicio.getTime();
  const pos = (d: Date) => ((d.getTime() - inicio.getTime()) / total) * 100;

  const meses: { etiqueta: string; ancho: number; enero: boolean }[] = [];
  for (let m = new Date(inicio); m < fin; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const siguiente = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    meses.push({
      etiqueta: mesCorto.format(m).replace(".", ""),
      ancho: ((siguiente.getTime() - m.getTime()) / total) * 100,
      enero: m.getMonth() === 0,
    });
  }

  return (
    <div className="border border-gray-20 px-3 pt-3 pb-2">
      <div className="relative h-11">
        {/* Hoy: una raya vertical, para ver de un vistazo qué ya venció. */}
        <div
          className="absolute top-0 bottom-0 w-px bg-marca"
          style={{ left: `${pos(hoy)}%` }}
          aria-hidden="true"
        />
        <div
          className="absolute top-0 font-rotulo text-[9.5px] tracking-[0.08em] text-marca uppercase"
          style={{ left: `calc(${pos(hoy)}% + 4px)` }}
        >
          hoy
        </div>

        {cuotas.map((c) => {
          const nueva = fechas[c.id] ? deTexto(fechas[c.id]!) : c.venceEl;
          const cambio = aTexto(nueva) !== aTexto(c.venceEl);
          return (
            <span key={c.id}>
              {cambio && (
                <span
                  className="absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-dashed border-gray-45 font-mono text-[10px] text-gray-45"
                  style={{ left: `${pos(c.venceEl)}%` }}
                  title={`Cuota ${c.numero}: hoy vence el ${fecha(c.venceEl)}`}
                >
                  {c.numero}
                </span>
              )}
              <span
                className={`absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border font-mono text-[10px] ${
                  cambio ? "border-ink bg-ink text-paper" : "border-ink bg-lienzo text-ink"
                }`}
                style={{ left: `${pos(nueva)}%` }}
                title={`Cuota ${c.numero}: ${fecha(nueva)}`}
              >
                {c.numero}
              </span>
            </span>
          );
        })}
      </div>

      <div className="mt-1 flex border-t border-gray-20">
        {meses.map((m, i) => (
          <div
            key={i}
            className={`overflow-hidden border-l border-gray-20 pt-1 pl-1 font-rotulo text-[9.5px] tracking-[0.06em] uppercase first:border-l-0 ${
              m.enero ? "text-ink" : "text-gray-45"
            }`}
            style={{ width: `${m.ancho}%` }}
          >
            {m.etiqueta}
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- modal */

export function GestionFechas({
  abierto,
  alCerrar,
  grupoId,
  grupoNombre,
  cuotas,
  alRefrescar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  grupoId: string;
  grupoNombre: string;
  cuotas: CuotaFechas[];
  alRefrescar: (mensaje?: string) => Promise<void>;
}) {
  /** Lo que hay en cada campo, por cuota, como "AAAA-MM-DD". */
  const [fechas, setFechas] = useState<Record<string, string>>({});
  const [diaTodas, setDiaTodas] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  // Cada vez que se abre, los campos arrancan con lo guardado. La clave con las
  // fechas adentro hace que, si otro cambio refresca el curso mientras está
  // abierto, los campos no se queden mostrando algo que ya no es.
  const guardadas = cuotas.map((c) => `${c.id}:${aTexto(c.venceEl)}`).join("|");
  useEffect(() => {
    if (!abierto) return;
    setFechas(Object.fromEntries(cuotas.map((c) => [c.id, aTexto(c.venceEl)])));
    setDiaTodas("");
    setConfirmando(false);
    // `guardadas` resume a `cuotas`: con ella alcanza.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, guardadas]);

  const ordenadas = useMemo(
    () => [...cuotas].sort((a, b) => a.numero - b.numero),
    [cuotas],
  );

  /** Lo que cambió respecto de lo guardado. */
  const cambios = useMemo(
    () =>
      ordenadas
        .filter((c) => fechas[c.id] && fechas[c.id] !== aTexto(c.venceEl))
        .map((c) => ({ cuota: c, venceEl: deTexto(fechas[c.id]!) })),
    [ordenadas, fechas],
  );

  /** La fecha que tendría cada cuota con lo editado. */
  const fechaDe = (c: CuotaFechas) =>
    fechas[c.id] ? deTexto(fechas[c.id]!) : c.venceEl;

  /**
   * Con qué vecina se cruza, si se cruza. La imputación es por número, así
   * que una cuota que vence después de la siguiente no rompe nada, pero se
   * dice: Fran tiene que saber que el orden de cobro ya no coincide con el
   * calendario.
   */
  const desordenDe = (c: CuotaFechas) => {
    const i = ordenadas.findIndex((x) => x.id === c.id);
    const mia = fechaDe(c).getTime();
    const anterior = ordenadas[i - 1];
    const siguiente = ordenadas[i + 1];
    if (anterior && mia < fechaDe(anterior).getTime())
      return { lado: "antes" as const, vecina: anterior };
    if (siguiente && mia > fechaDe(siguiente).getTime())
      return { lado: "después" as const, vecina: siguiente };
    return null;
  };

  const correr = (meses: number) =>
    setFechas((f) =>
      Object.fromEntries(
        ordenadas.map((c) => [c.id, aTexto(sumarMeses(f[c.id] ? deTexto(f[c.id]!) : c.venceEl, meses))]),
      ),
    );

  const diaValido = /^\d{1,2}$/.test(diaTodas) && Number(diaTodas) >= 1 && Number(diaTodas) <= 31;
  const aplicarDia = () =>
    setFechas((f) =>
      Object.fromEntries(
        ordenadas.map((c) => [c.id, aTexto(conDia(f[c.id] ? deTexto(f[c.id]!) : c.venceEl, Number(diaTodas)))]),
      ),
    );

  const descartar = () =>
    setFechas(Object.fromEntries(cuotas.map((c) => [c.id, aTexto(c.venceEl)])));

  const hoy = inicioDeHoy().getTime();

  return (
    <>
      <Modal
        abierto={abierto}
        alCerrar={alCerrar}
        eyebrow={grupoNombre}
        titulo="Gestión de fechas"
        ancho="w-[min(760px,calc(100vw-2rem))]"
      >
        <p className="mb-4 text-[14px] leading-relaxed text-gray-70">
          Las fechas de vencimiento de cada cuota del curso. Valen para todos los
          alumnos que no tengan fecha propia. Nada se guarda hasta que confirmes,
          y antes de confirmar se ve qué le pasa a cada familia.
        </p>

        <LineaDeTiempo cuotas={ordenadas} fechas={fechas} />

        {/* Las herramientas de a muchas: sólo llenan los campos, no guardan.
            Correr un plan entero un mes son trece ediciones; con esto es una. */}
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 border border-gray-20 px-4 py-3">
          <div>
            <Etiqueta>Correr todo el plan</Etiqueta>
            <div className="mt-2 flex gap-3">
              <BotonTexto onClick={() => correr(-1)}>Un mes antes</BotonTexto>
              <BotonTexto onClick={() => correr(1)}>Un mes después</BotonTexto>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Campo
              label="Todas el día"
              className="w-28"
              inputMode="numeric"
              value={diaTodas}
              onChange={(e) => setDiaTodas(e.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder="20"
            />
            <Boton variante="fantasma" onClick={aplicarDia} disabled={!diaValido}>
              Aplicar
            </Boton>
          </div>
        </div>

        <div className="mt-4 border border-gray-20">
          {ordenadas.map((c) => {
            const nueva = fechaDe(c);
            const cambio = aTexto(nueva) !== aTexto(c.venceEl);
            const desorden = desordenDe(c);
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-20 px-4 py-3 last:border-b-0"
              >
                <div className="w-28 shrink-0">
                  <div className="font-rotulo text-[11.5px] tracking-[0.06em] text-gray-45 uppercase">
                    Cuota {String(c.numero).padStart(2, "0")}
                  </div>
                  <div className="font-display text-[14px] tabular-nums">
                    {pesos(c.monto)}
                  </div>
                </div>

                <CampoFecha
                  label="Vence el"
                  className="min-w-[170px]"
                  valor={fechas[c.id] ?? aTexto(c.venceEl)}
                  alCambiar={(v) => setFechas((f) => ({ ...f, [c.id]: v }))}
                />

                <div className="min-w-0 flex-1 text-right">
                  {cambio && (
                    <div
                      className={`font-mono text-[11px] ${
                        nueva.getTime() < hoy ? "text-marca" : "text-ink"
                      }`}
                    >
                      {fecha(c.venceEl)} → {fecha(nueva)}
                      {nueva.getTime() < hoy && " · queda en el pasado"}
                    </div>
                  )}
                  <div className="nota text-[11.5px]">
                    {c.vencidas > 0
                      ? `${c.vencidas} ${c.vencidas === 1 ? "familia vencida" : "familias vencidas"}`
                      : "nadie vencido"}
                    {c.conFechaPropia > 0 &&
                      ` · ${c.conFechaPropia} con fecha propia: no ${c.conFechaPropia === 1 ? "cambia" : "cambian"}`}
                  </div>
                  {desorden && (
                    <div className="mt-1">
                      <Tag>Fuera de orden</Tag>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border border-gray-20 bg-paper-dim px-3.5 py-3">
          <span className="font-rotulo text-[11.5px] tracking-[0.08em] text-gray-45 uppercase">
            Se va a guardar
          </span>
          <span className="font-display text-[18px] tabular-nums">
            {cambios.length === 0
              ? "nada"
              : `${cambios.length} ${cambios.length === 1 ? "fecha" : "fechas"}`}
          </span>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Boton variante="fantasma" onClick={descartar} disabled={cambios.length === 0}>
            Descartar cambios
          </Boton>
          <Boton variante="fantasma" onClick={alCerrar}>
            Cerrar
          </Boton>
          <Boton onClick={() => setConfirmando(true)} disabled={cambios.length === 0}>
            <IconoCalendario />
            Guardar fechas
          </Boton>
        </div>
      </Modal>

      <ConfirmarFechas
        abierto={confirmando}
        grupoId={grupoId}
        grupoNombre={grupoNombre}
        cambios={cambios}
        desordenDe={desordenDe}
        alCancelar={() => setConfirmando(false)}
        alGuardado={async (n) => {
          setConfirmando(false);
          alCerrar();
          await alRefrescar(`${n} ${n === 1 ? "fecha guardada" : "fechas guardadas"}`);
        }}
      />
    </>
  );
}

/* -------------------------------------------------------- confirmación */

/**
 * La confirmación va aparte y con la vista previa adentro: acá se mueve la
 * mora de todo el curso, y el que aprieta tiene que leer a cuántas familias y
 * por cuánto antes de hacerlo.
 */
function ConfirmarFechas({
  abierto,
  grupoId,
  grupoNombre,
  cambios,
  desordenDe,
  alCancelar,
  alGuardado,
}: {
  abierto: boolean;
  grupoId: string;
  grupoNombre: string;
  cambios: { cuota: CuotaFechas; venceEl: Date }[];
  desordenDe: (c: CuotaFechas) => { lado: "antes" | "después"; vecina: CuotaFechas } | null;
  alCancelar: () => void;
  alGuardado: (cambiadas: number) => Promise<void>;
}) {
  const entrada = {
    grupoId,
    cambios: cambios.map((c) => ({ cuotaId: c.cuota.id, venceEl: c.venceEl })),
  };
  const previa = api.grupo.previsualizarFechas.useQuery(entrada, {
    enabled: abierto && cambios.length > 0,
  });
  const guardar = api.grupo.actualizarFechas.useMutation({
    onSuccess: (r) => alGuardado(r.cambiadas),
  });

  const p = previa.data;
  const hoy = inicioDeHoy().getTime();
  const alPasado = cambios.filter((c) => c.venceEl.getTime() < hoy);
  const conPropia = cambios.filter((c) => c.cuota.conFechaPropia > 0);
  const fueraDeOrden = cambios
    .map((c) => ({ c, d: desordenDe(c.cuota) }))
    .filter((x) => x.d !== null);
  const familias = (n: number) => `${n} ${n === 1 ? "familia" : "familias"}`;

  return (
    <Modal
      abierto={abierto}
      alCerrar={guardar.isPending ? () => undefined : alCancelar}
      eyebrow={grupoNombre}
      titulo={
        cambios.length === 1
          ? `Mover la cuota ${cambios[0]!.cuota.numero} al ${fecha(cambios[0]!.venceEl)}`
          : `Mover ${cambios.length} fechas`
      }
    >
      <ul className="grid gap-1 text-[14px] leading-relaxed text-gray-70">
        {cambios.map((c) => (
          <li key={c.cuota.id}>
            Cuota {c.cuota.numero}: {fecha(c.cuota.venceEl)} → {fecha(c.venceEl)}
            {c.venceEl.getTime() < hoy && (
              <span className="text-marca"> · queda en el pasado</span>
            )}
          </li>
        ))}
      </ul>

      {/* La previa: la misma función que después usan el panel, el cobro y la
          galería, corrida con las fechas nuevas. */}
      <div className="mt-4 border border-gray-20 bg-paper-dim px-3.5 py-3">
        {previa.isFetching && !p ? (
          <p className="nota text-[13px]">Calculando qué cambia para las familias…</p>
        ) : previa.isError ? (
          <p className="nota text-[13px] text-marca">
            No se pudo calcular qué cambia. Podés guardar igual.
          </p>
        ) : p ? (
          <>
            {(
              [
                ["Familias con alguna cuota vencida", String(p.vencidos.antes), String(p.vencidos.despues)],
                ["Mora acumulada del curso", pesos(p.mora.antes), pesos(p.mora.despues)],
              ] as const
            ).map(([texto, antes, despues]) => (
              <div key={texto} className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="nota text-[12px]">{texto}</span>
                <span className="font-display text-[15px] tabular-nums">
                  {antes} <span className="text-gray-45">→</span> {despues}
                </span>
              </div>
            ))}

            <div className="mt-2.5 border-t border-gray-20 pt-2.5 text-[13px] leading-relaxed">
              {p.suben === 0 && p.bajan === 0 && (
                <p className="text-gray-70">Hoy no cambia la deuda de nadie.</p>
              )}
              {p.bajan > 0 && (
                <p className="text-gray-70">
                  A {familias(p.bajan)} les baja la deuda: {pesos(p.menosDeuda)} menos
                  de recargo en total.
                  {p.quedanSinDeuda > 0 &&
                    ` ${p.quedanSinDeuda} ${p.quedanSinDeuda === 1 ? "queda" : "quedan"} sin deuda${
                      p.conGalerias ? ", que es lo que les abre la galería de entrega" : ""
                    }.`}
                </p>
              )}
              {p.suben > 0 && (
                <p className="flex items-start gap-2 text-marca">
                  <IconoAlerta className="mt-1 h-3.5 w-3.5 shrink-0" />
                  <span>
                    A {familias(p.suben)} les sube la deuda: {pesos(p.masDeuda)} más de
                    recargo en total.
                    {p.pasanADeber > 0 &&
                      ` ${p.pasanADeber} que hoy no ${p.pasanADeber === 1 ? "debe" : "deben"} nada ${
                        p.pasanADeber === 1 ? "pasa" : "pasan"
                      } a deber${p.conGalerias ? " y se les cierra la galería de entrega" : ""}.`}
                  </span>
                </p>
              )}
              {alPasado.length > 0 && (
                <p className="nota mt-1.5 text-[11.5px]">
                  Si esto es para arreglar una fecha mal cargada, la mora que se crea se
                  puede perdonar después desde Gestión de cuotas.
                </p>
              )}
            </div>
          </>
        ) : null}
      </div>

      {(fueraDeOrden.length > 0 || conPropia.length > 0) && (
        <div className="mt-3 grid gap-1.5">
          {fueraDeOrden.map(({ c, d }) => (
            <p key={c.cuota.id} className="nota flex items-start gap-2 text-[11.5px]">
              <IconoAlerta className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              La cuota {c.cuota.numero} queda {d!.lado} de la {d!.vecina.numero} (
              {fecha(d!.vecina.venceEl)}). Lo que se pague se sigue imputando por número.
            </p>
          ))}
          {conPropia.map((c) => (
            <p key={c.cuota.id} className="nota text-[11.5px]">
              {c.cuota.conFechaPropia}{" "}
              {c.cuota.conFechaPropia === 1 ? "alumno tiene" : "alumnos tienen"} fecha
              propia en la cuota {c.cuota.numero} y{" "}
              {c.cuota.conFechaPropia === 1 ? "se queda" : "se quedan"} con la suya.
            </p>
          ))}
        </div>
      )}

      <p className="nota mt-3 text-[11.5px]">
        No sale ningún mail. Cada familia ve las fechas nuevas en su página y en el
        próximo recordatorio.
      </p>

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Boton variante="fantasma" onClick={alCancelar} disabled={guardar.isPending}>
          Cancelar
        </Boton>
        <Boton
          onClick={() => guardar.mutate(entrada)}
          disabled={guardar.isPending || (previa.isFetching && !p && !previa.isError)}
        >
          {guardar.isPending
            ? "Guardando…"
            : `Guardar ${cambios.length} ${cambios.length === 1 ? "fecha" : "fechas"}`}
        </Boton>
      </div>
    </Modal>
  );
}
