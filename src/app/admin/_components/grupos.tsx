"use client";

import Link from "next/link";
import { useState } from "react";

import { CampoFecha } from "~/app/_components/campo-fecha";
import { IconoMas } from "~/app/_components/iconos";
import { Marca } from "~/app/_components/marca";
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
import { api } from "~/trpc/react";
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

      {crear.error && (
        <p className="nota text-marca">{crear.error.message}</p>
      )}

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
    <label className="flex flex-col gap-1.5">
      <Etiqueta>Cuenta que cobra</Etiqueta>
      <select
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        className="border border-ink bg-lienzo px-3 py-[11px] text-[14px]"
      >
        <option value="">La de por defecto</option>
        {cuentas
          ?.filter((c) => c.activa)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} — {c.proveedor === "MERCADOPAGO" ? "Mercado Pago" : "Talo"}{" "}
              {c.pista}
            </option>
          ))}
      </select>
    </label>
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

  const setCuota = (i: number, patch: Partial<{ monto: string; vence: string }>) =>
    setCuotas((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const validas = cuotas
    .map((c) => ({ monto: Number(c.monto), vence: c.vence }))
    .filter((c) => c.monto > 0 && c.vence);
  const total = validas.reduce((t, c) => t + c.monto, 0);
  const listo =
    cliente.trim().length >= 2 && evento.trim().length >= 2 && validas.length > 0;

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

export function Grupos() {
  const [modo, setModo] = useState<"" | "grupo" | "particular">("");
  const utils = api.useUtils();
  const { data: grupos, isLoading } = api.grupo.listar.useQuery();

  const sembrar = api.demo.sembrar.useMutation({
    onSuccess: () => utils.grupo.listar.invalidate(),
  });

  return (
    <>
      <Encabezado
        eyebrow="Cobros"
        titulo="Estado por cliente"
        bajada="Cada grupo es un rollo: círculo con tilde es al día, punteado con saldo, tachado con cuotas vencidas. Los particulares —bodas, 15— son un cliente único con su propio plan."
        acciones={
          modo === "" ? (
            <>
              <Boton onClick={() => setModo("grupo")}>Nuevo grupo</Boton>
              <Boton variante="fantasma" onClick={() => setModo("particular")}>
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
          <p className="font-rotulo text-[12px] uppercase tracking-[0.08em] text-gray-45">
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

      <div className="grid gap-4">
        {grupos?.map((g) => (
          <Link
            key={g.id}
            href={`/admin/grupos/${g.id}`}
            // Next ya prefetchea la pantalla al acercarse; esto prefetchea los
            // datos. Entre que el puntero entra a la tarjeta y el clic pasan
            // unos cientos de milisegundos, que suele ser todo lo que tarda la
            // consulta: cuando la pantalla abre, muchas veces ya están.
            onMouseEnter={() => void utils.grupo.detalle.prefetch({ id: g.id })}
            onFocus={() => void utils.grupo.detalle.prefetch({ id: g.id })}
            className="block border border-ink transition-colors hover:bg-paper-dim"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-20 px-6 py-5">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="text-[19px] leading-snug">{g.nombre}</h3>
                  {g.tipo === "PARTICULAR" && <Tag>Particular</Tag>}
                </div>
                <div className="font-rotulo text-[12px] uppercase tracking-[0.06em] text-gray-70">
                  {g.tipo === "PARTICULAR"
                    ? `${g.colegio} · ${g.resumen.cuotas} cuotas`
                    : `${g.colegio} · ${g.resumen.cuotas} cuotas · ${g.resumen.alumnos} alumnos`}
                </div>
              </div>
              <div className="max-w-[260px]">
                <Tira
                  alDia={g.resumen.alDia}
                  conDeuda={g.resumen.conDeuda}
                  vencidos={g.resumen.vencidos}
                />
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
        ))}
      </div>
    </>
  );
}
