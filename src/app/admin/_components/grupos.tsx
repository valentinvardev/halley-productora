"use client";

import Link from "next/link";
import { useState } from "react";

import { CampoFecha } from "~/app/_components/campo-fecha";
import {
  IconoAlerta,
  IconoBajar,
  IconoGrupos,
  IconoMas,
  IconoPapelera,
  IconoPerfil,
} from "~/app/_components/iconos";
import { Marca } from "~/app/_components/marca";
import { Modal } from "~/app/_components/modal";
import {
  Boton,
  BotonTexto,
  Campo,
  Dato,
  Encabezado,
  Etiqueta,
  Tag,
  Vacio,
} from "~/app/_components/ui";
import { pesos } from "~/lib/format";
import { Desplegable } from "~/app/_components/desplegable";
import { api, type RouterOutputs } from "~/trpc/react";
import { EsqueletoGrupos } from "./esqueletos";

/** Tira de marcas al estilo hoja de contacto: un cuadro por alumno. */
function Tira({
  alDia,
  conDeuda,
  vencidos,
}: {
  alDia: number;
  conDeuda: number;
  vencidos: number;
}) {
  const marcas = [
    ...Array<"confirmado">(alDia).fill("confirmado"),
    ...Array<"punteado">(Math.max(conDeuda - vencidos, 0)).fill("punteado"),
    ...Array<"tachado">(vencidos).fill("tachado"),
  ].slice(0, 40);

  if (marcas.length === 0) {
    return (
      <span className="font-rotulo text-[11.5px] uppercase tracking-[0.08em] text-gray-45">
        Sin alumnos cargados
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {marcas.map((tipo, i) => (
        <Marca
          key={i}
          tipo={tipo}
          className="h-4 w-4"
          grosor={tipo === "confirmado" ? 4 : 5}
          color={
            tipo === "punteado" ? "var(--color-gray-45)" : "var(--color-ink)"
          }
        />
      ))}
    </div>
  );
}

function FormularioGrupo({ alCerrar }: { alCerrar: () => void }) {
  const utils = api.useUtils();
  const crear = api.grupo.crear.useMutation({
    onSuccess: async () => {
      await utils.grupo.listar.invalidate();
      alCerrar();
    },
  });

  const [nombre, setNombre] = useState("");
  const [colegio, setColegio] = useState("");
  const [monto, setMonto] = useState("45000");
  const [cantidad, setCantidad] = useState("6");
  const [vence, setVence] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        crear.mutate({
          nombre,
          colegio,
          montoCuota: Number(monto),
          cantidadCuotas: Number(cantidad),
          // Mediodía local: evita que el selector se corra un día por zona horaria.
          primerVencimiento: new Date(`${vence}T12:00:00`),
          autoRegistro: true,
        });
      }}
      className="mb-10 grid gap-5 border border-ink p-8"
    >
      <div className="eyebrow">Nuevo grupo</div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Nombre del grupo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Egresados 2027 – Colegio San Martín"
          required
        />
        <Campo
          label="Colegio"
          value={colegio}
          onChange={(e) => setColegio(e.target.value)}
          placeholder="Colegio San Martín"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo
          label="Monto de cada cuota"
          type="number"
          min={1}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          required
        />
        <Campo
          label="Cantidad de cuotas"
          type="number"
          min={1}
          max={36}
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          hint="Una por mes, a partir del primer vencimiento."
          required
        />
        {/* El aviso de que falta la fecha va acá, pegado al campo que lo
            provoca, y no entre los botones: ahí se metía en el medio de
            "crear" y "cancelar", que en el teléfono quedaban apretados contra
            un texto que no tenía nada que ver con ellos. */}
        <div>
          <CampoFecha
            label="Vence la primera"
            valor={vence}
            alCambiar={setVence}
          />
          {!vence && (
            <p className="nota mt-1.5 text-[11.5px] text-marca">
              Falta la fecha del primer vencimiento
            </p>
          )}
        </div>
      </div>

      {crear.error && <p className="nota text-marca">{crear.error.message}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Boton type="submit" disabled={crear.isPending || !vence}>
          {crear.isPending ? "Creando…" : "Crear grupo y plan"}
        </Boton>
        <Boton type="button" variante="fantasma" onClick={alCerrar}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}

/** Selector de la cuenta que cobra. Vacío = la de por defecto. */
function SelectorCuenta({
  valor,
  alCambiar,
}: {
  valor: string;
  alCambiar: (v: string) => void;
}) {
  const { data: cuentas } = api.cuentaPago.listar.useQuery();
  return (
    <Desplegable
      label="Cuenta que cobra"
      valor={valor}
      alCambiar={alCambiar}
      opciones={[
        { valor: "", etiqueta: "La de por defecto" },
        ...(cuentas ?? [])
          .filter((c) => c.activa)
          .map((c) => ({
            valor: c.id,
            etiqueta: `${c.nombre} — ${c.proveedor === "MERCADOPAGO" ? "Mercado Pago" : "Talo"}`,
            nota: c.pista,
          })),
      ]}
    />
  );
}

/**
 * Alta de un cliente particular: una boda, un cumpleaños de 15. A diferencia del
 * grupo, el plan va cuota por cuota —una seña y un saldo no son iguales ni
 * mensuales—, y se elige de una la cuenta que cobra.
 */
function FormularioParticular({ alCerrar }: { alCerrar: () => void }) {
  const utils = api.useUtils();
  const crear = api.grupo.crearParticular.useMutation({
    onSuccess: async () => {
      await utils.grupo.listar.invalidate();
      alCerrar();
    },
  });

  const [cliente, setCliente] = useState("");
  const [evento, setEvento] = useState("Boda");
  const [email, setEmail] = useState("");
  const [cuentaPagoId, setCuentaPagoId] = useState("");
  const [cuotas, setCuotas] = useState<{ monto: string; vence: string }[]>([
    { monto: "", vence: "" },
  ]);

  const setCuota = (
    i: number,
    patch: Partial<{ monto: string; vence: string }>,
  ) => setCuotas((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const validas = cuotas
    .map((c) => ({ monto: Number(c.monto), vence: c.vence }))
    .filter((c) => c.monto > 0 && c.vence);
  const total = validas.reduce((t, c) => t + c.monto, 0);
  const listo =
    cliente.trim().length >= 2 &&
    evento.trim().length >= 2 &&
    validas.length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        crear.mutate({
          cliente,
          evento,
          email: email.trim() || undefined,
          cuentaPagoId: cuentaPagoId || undefined,
          cuotas: validas.map((c) => ({
            monto: c.monto,
            venceEl: new Date(`${c.vence}T12:00:00`),
          })),
        });
      }}
      className="mb-10 grid gap-5 border border-ink p-8"
    >
      <div className="eyebrow">Nuevo particular</div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Cliente"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          placeholder="Ana y Julián"
          required
        />
        <Campo
          label="Tipo de evento"
          value={evento}
          onChange={(e) => setEvento(e.target.value)}
          placeholder="Boda, 15 años…"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Email de contacto"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ana@mail.com"
          hint="Para mandarle el acceso y los avisos."
        />
        <SelectorCuenta valor={cuentaPagoId} alCambiar={setCuentaPagoId} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Etiqueta>Plan de cuotas</Etiqueta>
          <span className="nota text-[11.5px] text-gray-45">
            Total {pesos(total)}
          </span>
        </div>
        <div className="grid gap-3">
          {cuotas.map((c, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_1fr_auto] items-end gap-3"
            >
              <Campo
                label={`Cuota ${i + 1}`}
                type="number"
                min={1}
                value={c.monto}
                onChange={(e) => setCuota(i, { monto: e.target.value })}
                placeholder={i === 0 ? "Seña" : "Saldo"}
              />
              <CampoFecha
                label="Vence"
                valor={c.vence}
                alCambiar={(v) => setCuota(i, { vence: v })}
              />
              {cuotas.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setCuotas((cs) => cs.filter((_, j) => j !== i))
                  }
                  aria-label="Quitar cuota"
                  className="mb-[11px] px-2 py-2 font-mono text-[13px] text-gray-45 hover:text-marca"
                >
                  ✕
                </button>
              ) : (
                <span className="w-6" />
              )}
            </div>
          ))}
        </div>
        <BotonTexto
          onClick={() => setCuotas((cs) => [...cs, { monto: "", vence: "" }])}
          className="mt-3"
        >
          <IconoMas />
          Agregar cuota
        </BotonTexto>
      </div>

      {crear.error && <p className="nota text-marca">{crear.error.message}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Boton type="submit" disabled={crear.isPending || !listo}>
          {crear.isPending ? "Creando…" : "Crear cliente y plan"}
        </Boton>
        <Boton type="button" variante="fantasma" onClick={alCerrar}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}

type GrupoLista = RouterOutputs["grupo"]["listar"][number];

/** Los ceros de un resumen, para arrancar la suma. */
const SIN_NADA = {
  alumnos: 0,
  alDia: 0,
  conDeuda: 0,
  vencidos: 0,
  esperado: 0,
  recaudado: 0,
};

/**
 * Los números de varios cursos, sumados.
 *
 * Se suman los resúmenes ya calculados y no se recalcula nada: cada grupo trae
 * el suyo resuelto contra su propio plan, que es lo que permite que dos cursos
 * con planes distintos se puedan sumar sin que la cuenta deje de cerrar.
 */
function sumar(cursos: GrupoLista[]) {
  return cursos.reduce(
    (t, g) => ({
      alumnos: t.alumnos + g.resumen.alumnos,
      alDia: t.alDia + g.resumen.alDia,
      conDeuda: t.conDeuda + g.resumen.conDeuda,
      vencidos: t.vencidos + g.resumen.vencidos,
      esperado: t.esperado + g.resumen.esperado,
      recaudado: t.recaudado + g.resumen.recaudado,
    }),
    { ...SIN_NADA },
  );
}

export function Grupos() {
  const [modo, setModo] = useState<"" | "grupo" | "particular">("");
  const utils = api.useUtils();
  const { data: grupos, isLoading } = api.grupo.listar.useQuery();
  const { data: colegios } = api.colegio.listar.useQuery();

  /** Qué colegios están desplegados, para ver sus cursos por separado. */
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  /** El grupo al que se le está eligiendo colegio. */
  const [asignando, setAsignando] = useState<{
    id: string;
    nombre: string;
    colegioId: string | null;
  } | null>(null);
  /** El colegio que se está creando o renombrando. `id` nulo es uno nuevo. */
  const [editandoColegio, setEditandoColegio] = useState<{
    id: string | null;
    nombre: string;
  } | null>(null);
  const [borrandoColegio, setBorrandoColegio] = useState<{
    id: string;
    nombre: string;
    cursos: number;
  } | null>(null);

  const refrescar = async () => {
    await utils.colegio.listar.invalidate();
    await utils.grupo.listar.invalidate();
  };

  const sembrar = api.demo.sembrar.useMutation({ onSuccess: refrescar });
  const crearColegio = api.colegio.crear.useMutation({
    onSuccess: async () => {
      setEditandoColegio(null);
      await refrescar();
    },
  });
  const renombrarColegio = api.colegio.renombrar.useMutation({
    onSuccess: async () => {
      setEditandoColegio(null);
      await refrescar();
    },
  });
  const borrarColegio = api.colegio.eliminar.useMutation({
    onSuccess: async () => {
      setBorrandoColegio(null);
      await refrescar();
    },
  });
  const asignarColegio = api.colegio.asignar.useMutation({
    onSuccess: async () => {
      setAsignando(null);
      await refrescar();
    },
  });

  const prefetch = (id: string) => void utils.grupo.detalle.prefetch({ id });

  // Los cursos de cada colegio, y los que todavía no están en ninguno. Un
  // colegio recién creado se muestra igual aunque esté vacío: si desapareciera,
  // el que lo acaba de crear pensaría que no se guardó.
  const sueltos = (grupos ?? []).filter((g) => !g.agrupadoEn);
  const items = (colegios ?? []).map((c) => ({
    colegio: c,
    cursos: (grupos ?? []).filter((g) => g.agrupadoEn?.id === c.id),
  }));

  return (
    <>
      <Encabezado
        eyebrow="Cobros"
        titulo="Estado por cliente"
        bajada="Cada grupo es un rollo: círculo con tilde es al día, punteado con saldo, tachado con cuotas vencidas. Los colegios juntan varios cursos y muestran sus números sumados."
        acciones={
          modo === "" ? (
            <>
              {/* Los íconos dicen la diferencia que el texto no: uno crea un
                  curso entero y el otro un cliente solo. Cuatro cuadros contra
                  una persona se lee de un vistazo, "grupo" contra "particular"
                  hay que leerlo. */}
              <Boton onClick={() => setModo("grupo")}>
                <IconoGrupos />
                Nuevo grupo
              </Boton>
              <Boton variante="fantasma" onClick={() => setModo("particular")}>
                <IconoPerfil />
                Nuevo particular
              </Boton>
            </>
          ) : undefined
        }
      />

      {modo === "grupo" && <FormularioGrupo alCerrar={() => setModo("")} />}
      {modo === "particular" && (
        <FormularioParticular alCerrar={() => setModo("")} />
      )}

      {isLoading && <EsqueletoGrupos soloTarjetas />}

      {!isLoading && grupos?.length === 0 && (
        <div className="grid gap-5 border border-dashed border-gray-20 px-6 py-12 text-center">
          <p className="font-rotulo text-[12px] tracking-[0.08em] text-gray-45 uppercase">
            Todavía no hay grupos
          </p>
          <div className="flex justify-center">
            <Boton
              variante="fantasma"
              onClick={() => sembrar.mutate()}
              disabled={sembrar.isPending}
            >
              {sembrar.isPending ? "Cargando…" : "Cargar datos de demo"}
            </Boton>
          </div>
        </div>
      )}

      {/* El colegio junta varios cursos en un solo renglón. Va acá arriba de la
          lista y no entre las acciones del encabezado porque es una forma de
          mirar lo que ya hay, no una alta más. */}
      {!isLoading && (grupos?.length ?? 0) > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <BotonTexto
            onClick={() => setEditandoColegio({ id: null, nombre: "" })}
          >
            <IconoMas />
            Nuevo colegio
          </BotonTexto>
          <span className="nota text-[11.5px]">
            Junta varios cursos y suma sus números. Cada curso sigue con su plan
            y su cobro.
          </span>
        </div>
      )}

      <div className="grid gap-4">
        {items.map(({ colegio, cursos }) => {
          const suma = sumar(cursos);
          const abierto = abiertos.has(colegio.id);
          return (
            <div key={colegio.id} className="border border-ink">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-20 px-6 py-5">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <IconoGrupos className="text-gray-45" />
                    <h3 className="text-[19px] leading-snug">
                      {colegio.nombre}
                    </h3>
                  </div>
                  <div className="font-rotulo text-[12px] tracking-[0.06em] text-gray-70 uppercase">
                    {cursos.length} {cursos.length === 1 ? "curso" : "cursos"} ·{" "}
                    {suma.alumnos} alumnos
                  </div>
                </div>
                <div className="max-w-[260px]">
                  <Tira
                    alDia={suma.alDia}
                    conDeuda={suma.conDeuda}
                    vencidos={suma.vencidos}
                  />
                </div>
              </div>

              {/* Los mismos cuatro números que un curso, pero sumados. */}
              <div className="flex flex-wrap">
                <Dato rotulo="Recaudado" valor={pesos(suma.recaudado)} />
                <Dato rotulo="Plan total" valor={pesos(suma.esperado)} />
                <Dato rotulo="Al día" valor={`${suma.alDia}/${suma.alumnos}`} />
                <Dato rotulo="Con vencidas" valor={suma.vencidos} />
              </div>

              <div className="flex flex-wrap items-center gap-4 border-t border-gray-20 px-6 py-3">
                <BotonTexto
                  onClick={() =>
                    setAbiertos((s) => {
                      const n = new Set(s);
                      if (n.has(colegio.id)) n.delete(colegio.id);
                      else n.add(colegio.id);
                      return n;
                    })
                  }
                >
                  <IconoBajar
                    className={`h-3 w-3 transition-transform ${
                      abierto ? "rotate-180" : ""
                    }`}
                  />
                  {abierto
                    ? "Ocultar los cursos"
                    : cursos.length === 1
                      ? "Ver el curso"
                      : `Ver los ${cursos.length} cursos`}
                </BotonTexto>
                <span className="ml-auto flex flex-wrap gap-3">
                  <BotonTexto
                    onClick={() =>
                      setEditandoColegio({
                        id: colegio.id,
                        nombre: colegio.nombre,
                      })
                    }
                  >
                    Renombrar
                  </BotonTexto>
                  <BotonTexto
                    onClick={() =>
                      setBorrandoColegio({
                        id: colegio.id,
                        nombre: colegio.nombre,
                        cursos: cursos.length,
                      })
                    }
                  >
                    Borrar
                  </BotonTexto>
                </span>
              </div>

              {abierto && (
                <div className="grid gap-3 border-t border-gray-20 bg-paper-dim p-4">
                  {cursos.length === 0 ? (
                    <p className="nota text-center text-[12.5px]">
                      Todavía no hay cursos acá. Se eligen desde el botón
                      Colegio de cualquier grupo.
                    </p>
                  ) : (
                    cursos.map((g) => (
                      <TarjetaGrupo
                        key={g.id}
                        g={g}
                        alPrefetch={prefetch}
                        alElegirColegio={() =>
                          setAsignando({
                            id: g.id,
                            nombre: g.nombre,
                            colegioId: g.agrupadoEn?.id ?? null,
                          })
                        }
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {items.length > 0 && sueltos.length > 0 && (
          <p className="mt-2 font-rotulo text-[11.5px] tracking-[0.08em] text-gray-45 uppercase">
            Sin colegio
          </p>
        )}

        {sueltos.map((g) => (
          <TarjetaGrupo
            key={g.id}
            g={g}
            alPrefetch={prefetch}
            alElegirColegio={() =>
              setAsignando({
                id: g.id,
                nombre: g.nombre,
                colegioId: g.agrupadoEn?.id ?? null,
              })
            }
          />
        ))}
      </div>

      {/* ------------------------------------------------- elegir el colegio */}
      <Modal
        abierto={asignando !== null}
        alCerrar={() => setAsignando(null)}
        eyebrow={asignando?.nombre}
        titulo="En qué colegio va"
      >
        <p className="nota max-w-[60ch] text-[13px]">
          Es sólo para verlo junto a los demás cursos del mismo lugar. No cambia
          su plan de cuotas, ni su link de registro, ni la cuenta que cobra.
        </p>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {[
            { id: null as string | null, nombre: "Sin colegio" },
            ...(colegios ?? []),
          ].map((c) => {
            const puesto = (asignando?.colegioId ?? null) === c.id;
            return (
              <button
                key={c.id ?? "ninguno"}
                type="button"
                onClick={() =>
                  asignando &&
                  asignarColegio.mutate({
                    grupoIds: [asignando.id],
                    colegioId: c.id,
                  })
                }
                disabled={asignarColegio.isPending}
                className={`cursor-pointer border px-3 py-2 font-rotulo text-[11.5px] tracking-[0.06em] uppercase transition-colors ${
                  puesto
                    ? "border-ink bg-ink text-paper"
                    : "border-gray-20 text-gray-70 hover:border-ink hover:text-ink"
                }`}
              >
                {c.nombre}
              </button>
            );
          })}
        </div>

        {(colegios?.length ?? 0) === 0 && (
          <p className="nota mt-3 text-[12px]">
            Todavía no hay colegios. Creá uno con el botón de arriba de la
            lista.
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <Boton variante="fantasma" onClick={() => setAsignando(null)}>
            Cerrar
          </Boton>
        </div>
      </Modal>

      {/* --------------------------------------------- crear o renombrar uno */}
      <Modal
        abierto={editandoColegio !== null}
        alCerrar={() => setEditandoColegio(null)}
        eyebrow="Colegios"
        titulo={editandoColegio?.id ? "Renombrar el colegio" : "Nuevo colegio"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const nombre = editandoColegio?.nombre.trim() ?? "";
            if (nombre.length < 2) return;
            if (editandoColegio?.id) {
              renombrarColegio.mutate({ id: editandoColegio.id, nombre });
            } else {
              crearColegio.mutate({ nombre });
            }
          }}
        >
          <Campo
            label="Nombre del colegio"
            placeholder="Jesús María"
            value={editandoColegio?.nombre ?? ""}
            onChange={(e) =>
              setEditandoColegio((c) =>
                c ? { ...c, nombre: e.target.value } : c,
              )
            }
            hint="Sin el año: el año va en el nombre de cada curso."
            maxLength={80}
            autoFocus
          />
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Boton
              variante="fantasma"
              type="button"
              onClick={() => setEditandoColegio(null)}
            >
              Cancelar
            </Boton>
            <Boton
              type="submit"
              disabled={
                (editandoColegio?.nombre.trim().length ?? 0) < 2 ||
                crearColegio.isPending ||
                renombrarColegio.isPending
              }
            >
              {crearColegio.isPending || renombrarColegio.isPending
                ? "Guardando…"
                : editandoColegio?.id
                  ? "Renombrar"
                  : "Crear colegio"}
            </Boton>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------ borrar */}
      <Modal
        abierto={borrandoColegio !== null}
        alCerrar={() => setBorrandoColegio(null)}
        eyebrow={borrandoColegio?.nombre}
        titulo="Borrar el colegio"
      >
        <p className="flex items-start gap-2.5 text-[14px] leading-relaxed text-gray-70">
          <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {borrandoColegio?.cursos === 0
              ? "No tiene cursos adentro, así que no se pierde nada."
              : `No se borra ningún grupo ni se toca un peso. ${
                  borrandoColegio?.cursos === 1
                    ? "El curso que tenía adentro vuelve"
                    : `Los ${borrandoColegio?.cursos} cursos que tenía adentro vuelven`
                } a la lista, sin colegio.`}
          </span>
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Boton variante="fantasma" onClick={() => setBorrandoColegio(null)}>
            Cancelar
          </Boton>
          <Boton
            onClick={() =>
              borrandoColegio &&
              borrarColegio.mutate({ id: borrandoColegio.id })
            }
            disabled={borrarColegio.isPending}
          >
            <IconoPapelera />
            {borrarColegio.isPending ? "Borrando…" : "Borrar"}
          </Boton>
        </div>
      </Modal>
    </>
  );
}

/**
 * La tarjeta de un curso.
 *
 * Es la misma esté suelta o adentro de un colegio: lo único que cambia es dónde
 * se dibuja. El botón de colegio va adentro del link, así que frena el clic
 * para que elegir carpeta no abra el grupo.
 */
function TarjetaGrupo({
  g,
  alPrefetch,
  alElegirColegio,
}: {
  g: GrupoLista;
  alPrefetch: (id: string) => void;
  alElegirColegio: () => void;
}) {
  return (
    <Link
      href={`/admin/grupos/${g.id}`}
      // Next ya prefetchea la pantalla al acercarse; esto prefetchea los datos.
      // Entre que el puntero entra a la tarjeta y el clic pasan unos cientos de
      // milisegundos, que suele ser todo lo que tarda la consulta: cuando la
      // pantalla abre, muchas veces ya están.
      onMouseEnter={() => alPrefetch(g.id)}
      onFocus={() => alPrefetch(g.id)}
      className="block border border-ink bg-paper transition-colors hover:bg-paper-dim"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-20 px-6 py-5">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="text-[19px] leading-snug">{g.nombre}</h3>
            {g.tipo === "PARTICULAR" && <Tag>Particular</Tag>}
            {g.modoPrueba && <Tag>Modo prueba</Tag>}
          </div>
          <div className="font-rotulo text-[12px] tracking-[0.06em] text-gray-70 uppercase">
            {g.tipo === "PARTICULAR"
              ? `${g.colegio} · ${g.resumen.cuotas} cuotas`
              : `${g.colegio} · ${g.resumen.cuotas} cuotas · ${g.resumen.alumnos} alumnos`}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-4">
          <div className="max-w-[260px]">
            <Tira
              alDia={g.resumen.alDia}
              conDeuda={g.resumen.conDeuda}
              vencidos={g.resumen.vencidos}
            />
          </div>
          {g.tipo !== "PARTICULAR" && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                alElegirColegio();
              }}
              title="Elegir el colegio que lo agrupa"
              className="cursor-pointer border border-gray-20 px-2.5 py-1.5 font-rotulo text-[11px] tracking-[0.06em] text-gray-70 uppercase transition-colors hover:border-ink hover:text-ink"
            >
              {g.agrupadoEn ? g.agrupadoEn.nombre : "Sin colegio"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap">
        <Dato rotulo="Recaudado" valor={pesos(g.resumen.recaudado)} />
        <Dato rotulo="Plan total" valor={pesos(g.resumen.esperado)} />
        <Dato
          rotulo="Al día"
          valor={`${g.resumen.alDia}/${g.resumen.alumnos}`}
        />
        <Dato rotulo="Con vencidas" valor={g.resumen.vencidos} />
      </div>
    </Link>
  );
}
