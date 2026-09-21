"use client";

import { useEffect, useMemo, useState } from "react";

import { IconoAlerta, IconoTilde } from "~/app/_components/iconos";
import { Desplegable } from "~/app/_components/desplegable";
import { Modal } from "~/app/_components/modal";
import { Boton, Etiqueta } from "~/app/_components/ui";
import { pesos } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * Gestión de cuotas: marcarlas como pagas sin que haya entrado un pago real.
 *
 * Es para lo que pasa siempre: la familia pagó en efectivo, o transfirió a otra
 * cuenta, o arregló de palabra. Hasta ahora eso no tenía cómo entrar al sistema y
 * la cuota quedaba figurando impaga para siempre.
 *
 * Marcar una cuota crea un pago, y no es un rodeo: acá el estado de una cuota no
 * se guarda en ningún lado, se deriva repartiendo lo pagado sobre el plan. No hay
 * tilde que poner. Que la única forma de saldar una cuota sea registrar el pago
 * que la salda es lo que mantiene al panel diciendo lo mismo que dicen los pagos.
 *
 * El orden es primero a quién y después qué, y no al revés. La versión anterior
 * pedía elegir un alcance —un alumno o todo el grupo— antes de ver a nadie, y eso
 * no se parece a lo que uno hace: uno sabe que Fulano pagó, lo busca, y recién
 * ahí dice qué pagó. Con una lista de casillas el caso de uno y el de todos son
 * el mismo gesto con distinta cantidad de tildes.
 *
 * Y muestra el total antes de confirmar. Cada alumno trae su plan ya imputado, así
 * que se puede sumar exactamente lo que se va a registrar sin preguntarle nada al
 * servidor. Ver "$ 481.500 en 12 pagos" antes de apretar es lo que evita el error
 * que después no se deshace.
 */

/** "1, 3 y 4": para nombrar las cuotas elegidas en una frase. */
function listar(numeros: number[]) {
  if (numeros.length <= 1) return numeros.join("");
  return `${numeros.slice(0, -1).join(", ")} y ${numeros.at(-1)}`;
}

export type AlumnoCuotas = {
  id: string;
  nombre: string;
  deuda: number;
  /** Lo mismo sin la mora: sólo el capital que falta. */
  deudaSinMora: number;
  /** El plan imputado: cuánto falta de cada cuota, hoy, con la mora incluida. */
  cuotas: { numero: number; saldo: number; saldoSinMora: number }[];
  /** Lo que se marcó a mano: es lo único que se puede deshacer. */
  manual: { cantidad: number; total: number };
};

export function GestionCuotas({
  abierto,
  alCerrar,
  grupoNombre,
  totalCuotas,
  alumnos,
  alRefrescar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  grupoNombre: string;
  totalCuotas: number;
  alumnos: AlumnoCuotas[];
  alRefrescar: (mensaje?: string) => Promise<void>;
}) {
  // Con un solo alumno —bodas, quince— no hay nada que elegir: viene tildado.
  const unico = alumnos.length === 1;
  const [elegidos, setElegidos] = useState<Set<string>>(
    () => new Set(unico ? alumnos.map((a) => a.id) : []),
  );

  /** Qué cuotas se marcan, por número. Vacío es todo lo que falte. */
  const [cuotas, setCuotas] = useState<number[]>([]);
  const [confirmando, setConfirmando] = useState(false);

  /** Marcar o deshacer. Son la misma pantalla porque comparten la selección. */
  const [modo, setModo] = useState<"marcar" | "deshacer">("marcar");
  /** Al deshacer: todos los marcados a mano, o sólo el último de cada uno. */
  const [todosLosManuales, setTodosLosManuales] = useState(false);
  /**
   * Si el pago que se registra incluye la mora.
   *
   * Viene en sí, que es lo que se hacía siempre. El caso de destildarlo es
   * el de la familia que pagó por otro medio y se carga tarde: el atraso
   * fue administrativo y cobrarle el recargo sería cobrarle un error
   * nuestro. Al destildarlo la mora de esas cuotas queda perdonada.
   */
  const [cobrarMora, setCobrarMora] = useState(true);

  /**
   * Cada vez que se abre, la pantalla arranca limpia.
   *
   * El componente queda montado aunque esté cerrado, así que sin esto la
   * selección se decidía una sola vez, en el primer render de la página. Al
   * entrar desde la ficha de un alumno la lista llega con él solo, pero ya
   * era tarde para tildarlo: el modal abría con todo en cero.
   */
  const idsClave = alumnos.map((a) => a.id).join(",");
  useEffect(() => {
    if (!abierto) return;
    setElegidos(new Set(unico ? idsClave.split(",") : []));
    setCobrarMora(true);
    setCuotas([]);
    setModo("marcar");
  }, [abierto, unico, idsClave]);

  const avisar = async (n: number, total: number, verbo: string) => {
    setConfirmando(false);
    await alRefrescar(
      n === 0
        ? "No había nada que hacer"
        : `${n} pago${n === 1 ? "" : "s"} ${verbo} por ${pesos(total)}`,
    );
    alCerrar();
  };

  const deshacer = api.pago.desmarcarCuotas.useMutation({
    onSuccess: (r) =>
      avisar(r.borrados, r.total, "deshecho" + (r.borrados === 1 ? "" : "s")),
  });

  const marcar = api.pago.marcarCuotas.useMutation({
    onSuccess: async (r) => {
      setConfirmando(false);
      await alRefrescar(
        r.registrados === 0
          ? "No había nada que saldar"
          : `${r.registrados} pago${r.registrados === 1 ? "" : "s"} por ${pesos(r.total)}`,
      );
      alCerrar();
    },
  });

  /**
   * Lo que se va a registrar con lo que está tildado ahora.
   *
   * Se cuentan sólo los que tienen algo que saldar: a alguien que ya pagó esa
   * cuota no se le crea un pago de cero, así que tampoco se lo cuenta.
   */
  const previo = useMemo(() => {
    let capital = 0;
    let mora = 0;
    let total = 0;
    let cuantos = 0;
    for (const a of alumnos) {
      if (!elegidos.has(a.id)) continue;

      if (modo === "deshacer") {
        if (a.manual.cantidad === 0) continue;
        // Con "el último" se saca uno solo por alumno; el monto exacto de ese
        // pago no vino, así que se muestra el promedio y se aclara al confirmar.
        cuantos += todosLosManuales ? a.manual.cantidad : 1;
        total += todosLosManuales
          ? a.manual.total
          : a.manual.total / a.manual.cantidad;
        continue;
      }

      // Las dos cifras salen del mismo plan ya imputado, así que el desglose
      // es exacto y no una estimación: es lo que se va a registrar.
      const elegidas =
        cuotas.length === 0
          ? a.cuotas
          : a.cuotas.filter((c) => cuotas.includes(c.numero));
      const linea = elegidas.reduce(
        (t, c) => ({ con: t.con + c.saldo, sin: t.sin + c.saldoSinMora }),
        { con: 0, sin: 0 },
      );
      if (linea.con > 0) {
        capital += linea.sin;
        mora += linea.con - linea.sin;
        total += cobrarMora ? linea.con : linea.sin;
        cuantos += 1;
      }
    }
    return { capital, mora, total, cuantos };
  }, [alumnos, elegidos, cuotas, modo, todosLosManuales, cobrarMora]);

  const alternar = (id: string) =>
    setElegidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const deben = alumnos.filter((a) => a.deuda > 0);

  return (
    <>
      <Modal
        abierto={abierto}
        alCerrar={alCerrar}
        eyebrow={grupoNombre}
        titulo="Gestión de cuotas"
      >
        <div className="flex gap-2">
          {(
            [
              ["marcar", "Marcar pagas"],
              ["deshacer", "Deshacer"],
            ] as const
          ).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setModo(valor)}
              className={`flex-1 border px-3.5 py-2 font-rotulo text-[11.5px] tracking-[0.06em] uppercase transition-colors ${
                modo === valor
                  ? "border-ink bg-ink text-paper"
                  : "border-gray-20 text-gray-70 hover:border-ink hover:text-ink"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[14px] leading-relaxed text-gray-70">
          {modo === "marcar"
            ? "Elegí a quiénes y qué cuota. Se registra el pago que la salda por lo que falte hoy. Es para lo que se cobró por fuera del sistema: en efectivo, a otra cuenta, o de palabra."
            : "Saca los pagos que se marcaron a mano y las cuotas vuelven a figurar como estaban. Los que entraron por Talo o Mercado Pago no se tocan: esa plata entró de verdad."}
        </p>

        {!unico && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {(
              [
                ["Todos", () => new Set(alumnos.map((a) => a.id))],
                ["Los que deben", () => new Set(deben.map((a) => a.id))],
                ["Ninguno", () => new Set<string>()],
              ] as const
            ).map(([texto, arma]) => (
              <button
                key={texto}
                type="button"
                onClick={() => setElegidos(arma())}
                className="border border-gray-20 px-3 py-1.5 font-rotulo text-[11px] tracking-[0.06em] text-gray-70 uppercase transition-colors hover:border-ink hover:text-ink"
              >
                {texto}
              </button>
            ))}
            <span className="nota ml-auto text-[11.5px]">
              {elegidos.size} de {alumnos.length}
            </span>
          </div>
        )}

        <ul className="mt-3 max-h-[38vh] divide-y divide-gray-20 overflow-y-auto border border-gray-20">
          {alumnos.map((a) => {
            const tildado = elegidos.has(a.id);
            return (
              <li key={a.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-paper-dim">
                  <input
                    type="checkbox"
                    checked={tildado}
                    onChange={() => alternar(a.id)}
                    className="h-4 w-4 shrink-0 accent-[var(--color-ink)]"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">
                    {a.nombre}
                  </span>
                  {/* En cada modo importa un número distinto: para marcar,
                      cuánto debe; para deshacer, cuánto se le marcó a mano. */}
                  <span
                    className={`shrink-0 font-display text-[13.5px] tabular-nums ${
                      (modo === "marcar" ? a.deuda : a.manual.total) > 0
                        ? "text-ink"
                        : "text-gray-45"
                    }`}
                  >
                    {modo === "marcar"
                      ? a.deuda > 0
                        ? `debe ${pesos(a.deuda)}`
                        : "al día"
                      : a.manual.cantidad > 0
                        ? `${a.manual.cantidad} a mano`
                        : "sin marcas"}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 grid gap-3">
          {modo === "marcar" ? (
            // Cuotas sueltas, tildando las que se pagaron. Era un desplegable de
            // una sola, y lo normal es marcar varias juntas: la familia que se
            // puso al día con tres meses de una no se carga de a una por vez.
            <div>
              <Etiqueta>Qué se marca</Etiqueta>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCuotas([])}
                  className={`cursor-pointer border px-2.5 py-1.5 font-rotulo text-[11px] tracking-[0.06em] uppercase transition-colors ${
                    cuotas.length === 0
                      ? "border-ink bg-ink text-paper"
                      : "border-gray-20 text-gray-70 hover:border-ink hover:text-ink"
                  }`}
                >
                  Todo lo que falte
                </button>
                {Array.from({ length: totalCuotas }, (_, i) => i + 1).map(
                  (n) => {
                    const puesta = cuotas.includes(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={puesta}
                        onClick={() =>
                          setCuotas((s) =>
                            s.includes(n)
                              ? s.filter((x) => x !== n)
                              : [...s, n].sort((a, b) => a - b),
                          )
                        }
                        className={`w-10 cursor-pointer border px-2.5 py-1.5 font-rotulo text-[11px] tracking-[0.06em] uppercase transition-colors ${
                          puesta
                            ? "border-ink bg-ink text-paper"
                            : "border-gray-20 text-gray-70 hover:border-ink hover:text-ink"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  },
                )}
              </div>
              <p className="nota mt-1.5 text-[11.5px]">
                {cuotas.length === 0
                  ? "Se salda todo lo que cada uno deba."
                  : `Se saldan ${cuotas.length === 1 ? "la cuota" : "las cuotas"} ${listar(cuotas)}, y sólo lo que falte de ${cuotas.length === 1 ? "ella" : "ellas"}.`}
              </p>
            </div>
          ) : (
            <Desplegable
              label="Qué se deshace"
              valor={todosLosManuales ? "todos" : "ultimo"}
              alCambiar={(v) => setTodosLosManuales(v === "todos")}
              opciones={[
                { valor: "ultimo", etiqueta: "El último marcado de cada uno" },
                {
                  valor: "todos",
                  etiqueta: "Todos los marcados a mano",
                },
              ]}
            />
          )}

          {/* La casilla aparece sólo cuando hay mora que cobrar: si no hay,
              es un control que no cambia nada y sólo hace dudar. */}
          {modo === "marcar" && previo.mora > 0 && (
            <label className="flex cursor-pointer items-start gap-2.5 border border-gray-20 px-3.5 py-3">
              <input
                type="checkbox"
                checked={cobrarMora}
                onChange={(e) => setCobrarMora(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-ink)]"
              />
              <span className="min-w-0">
                <span className="block font-rotulo text-[11.5px] tracking-[0.06em] uppercase">
                  Cobrar la mora
                </span>
                <span className="nota mt-0.5 block text-[11.5px]">
                  {cobrarMora
                    ? "Se cobra el recargo por el atraso, como siempre."
                    : "El recargo queda perdonado y no vuelve a aparecer."}
                </span>
              </span>
            </label>
          )}

          {/* El total sale de los planes que ya vinieron imputados, así que es el
              monto exacto y no una estimación. Con mora de por medio se muestra
              el desglose: "cuánto de esto es recargo" es justo lo que hay que
              saber para decidir si se cobra. */}
          <div className="border border-gray-20 bg-paper-dim px-3.5 py-3">
            {modo === "marcar" && previo.mora > 0 && (
              <div className="mb-2.5 grid gap-1.5 border-b border-gray-20 pb-2.5">
                {(
                  [
                    ["Capital", previo.capital, false],
                    ["Mora", previo.mora, !cobrarMora],
                  ] as const
                ).map(([texto, monto, tachado]) => (
                  <div
                    key={texto}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="nota text-[12px]">{texto}</span>
                    <span
                      className={`font-display text-[14px] tabular-nums ${
                        tachado ? "text-gray-45 line-through" : "text-gray-70"
                      }`}
                    >
                      {pesos(monto)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-rotulo text-[11.5px] tracking-[0.08em] text-gray-45 uppercase">
                {modo === "marcar" ? "Se va a registrar" : "Se va a deshacer"}
              </span>
              <span className="font-display text-[18px] tabular-nums">
                {previo.cuantos === 0
                  ? "nada"
                  : `${pesos(previo.total)} · ${previo.cuantos} pago${
                      previo.cuantos === 1 ? "" : "s"
                    }`}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Boton variante="fantasma" onClick={alCerrar}>
            Cerrar
          </Boton>
          <Boton
            onClick={() => setConfirmando(true)}
            disabled={previo.cuantos === 0}
          >
            <IconoTilde />
            {modo === "marcar" ? "Marcar como paga" : "Deshacer"}
          </Boton>
        </div>
      </Modal>

      {/* La confirmación va aparte y no en un `confirm` del navegador: acá se
          registra plata, y el que aprieta tiene que leer a cuántos y por cuánto
          antes de hacerlo. */}
      <Modal
        abierto={confirmando}
        alCerrar={() => setConfirmando(false)}
        eyebrow={grupoNombre}
        titulo={
          modo === "deshacer"
            ? todosLosManuales
              ? "Deshacer todo lo marcado a mano"
              : "Deshacer el último marcado"
            : cuotas.length === 0
              ? "Marcar todo lo que falte"
              : cuotas.length === 1
                ? `Marcar la cuota ${cuotas[0]}`
                : `Marcar las cuotas ${listar(cuotas)}`
        }
      >
        <p className="text-[14px] leading-relaxed text-gray-70">
          {modo === "marcar" ? (
            <>
              Se registran{" "}
              <strong className="text-ink">
                {previo.cuantos} pago{previo.cuantos === 1 ? "" : "s"} por{" "}
                {pesos(previo.total)}
              </strong>
              {previo.mora > 0
                ? cobrarMora
                  ? ", con la mora incluida."
                  : `, sin la mora. Se le perdonan ${pesos(previo.mora)} de recargo, y no vuelven a aparecer.`
                : "."}
            </>
          ) : (
            <>
              Se borran{" "}
              <strong className="text-ink">
                {previo.cuantos} pago{previo.cuantos === 1 ? "" : "s"} marcado
                {previo.cuantos === 1 ? "" : "s"} a mano
              </strong>{" "}
              y esas cuotas vuelven a figurar impagas. Los que entraron por Talo
              o Mercado Pago no se tocan.
              {todosLosManuales &&
                " Si le habías perdonado la mora a alguna cuota, también vuelve."}
            </>
          )}
        </p>

        {previo.cuantos > 1 && (
          <p className="nota mt-3 flex items-start gap-2 text-marca">
            <IconoAlerta className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            No se deshacen desde acá.
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Boton variante="fantasma" onClick={() => setConfirmando(false)}>
            Cancelar
          </Boton>
          <Boton
            onClick={() =>
              modo === "marcar"
                ? marcar.mutate({
                    alumnoIds: [...elegidos],
                    cuotas,
                    cobrarMora,
                  })
                : deshacer.mutate({
                    alumnoIds: [...elegidos],
                    todos: todosLosManuales,
                  })
            }
            disabled={marcar.isPending || deshacer.isPending}
          >
            {marcar.isPending || deshacer.isPending
              ? "Aplicando…"
              : modo === "marcar"
                ? "Registrar"
                : "Deshacer"}
          </Boton>
        </div>
      </Modal>
    </>
  );
}
