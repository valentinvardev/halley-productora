"use client";

import Link from "next/link";
import { useState } from "react";

import { Marca } from "~/app/_components/marca";
import { Boton, Campo, Dato, Encabezado, Vacio } from "~/app/_components/ui";
import { fecha, pesos } from "~/lib/format";
import { api } from "~/trpc/react";

/** Tira de marcas al estilo hoja de contacto: un cuadro por padre. */
function Tira({
  pagados,
  pendientes,
  vencidos,
}: {
  pagados: number;
  pendientes: number;
  vencidos: number;
}) {
  const marcas = [
    ...Array<"confirmado">(pagados).fill("confirmado"),
    ...Array<"punteado">(pendientes).fill("punteado"),
    ...Array<"tachado">(vencidos).fill("tachado"),
  ].slice(0, 40);

  if (marcas.length === 0) {
    return (
      <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-gray-45">
        Sin padres cargados
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
          // El tilde necesita un trazo más fino para leerse a este tamaño.
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
  const [cuotaActual, setCuotaActual] = useState("1");
  const [cuotasTotales, setCuotasTotales] = useState("6");
  const [vence, setVence] = useState("");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    crear.mutate({
      nombre,
      colegio,
      montoCuota: Number(monto),
      cuotaActual: Number(cuotaActual),
      cuotasTotales: Number(cuotasTotales),
      // Mediodía local: evita que el input date se corra un día por zona horaria.
      venceEl: new Date(`${vence}T12:00:00`),
      autoRegistro: true,
    });
  }

  return (
    <form onSubmit={enviar} className="mb-10 grid gap-5 border border-ink p-8">
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

      <div className="grid gap-4 sm:grid-cols-4">
        <Campo
          label="Monto de la cuota"
          type="number"
          min={1}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          required
        />
        <Campo
          label="Cuota número"
          type="number"
          min={1}
          value={cuotaActual}
          onChange={(e) => setCuotaActual(e.target.value)}
          required
        />
        <Campo
          label="De un total de"
          type="number"
          min={1}
          value={cuotasTotales}
          onChange={(e) => setCuotasTotales(e.target.value)}
          required
        />
        <Campo
          label="Vence el"
          type="date"
          value={vence}
          onChange={(e) => setVence(e.target.value)}
          required
        />
      </div>

      {crear.error && (
        <p className="font-mono text-[11px] text-marca">{crear.error.message}</p>
      )}

      <div className="flex gap-3">
        <Boton type="submit" disabled={crear.isPending}>
          {crear.isPending ? "Creando…" : "Crear grupo"}
        </Boton>
        <Boton type="button" variante="fantasma" onClick={alCerrar}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}

export function Grupos() {
  const [abierto, setAbierto] = useState(false);
  const utils = api.useUtils();
  const { data: grupos, isLoading } = api.grupo.listar.useQuery();

  const sembrar = api.demo.sembrar.useMutation({
    onSuccess: () => utils.grupo.listar.invalidate(),
  });

  return (
    <>
      <Encabezado
        eyebrow="Cobros — grupos"
        titulo="Estado por grupo"
        bajada="Cada grupo es un rollo: círculo con tilde es pagado, punteado pendiente, tachado vencido."
        acciones={
          !abierto ? (
            <Boton onClick={() => setAbierto(true)}>Nuevo grupo</Boton>
          ) : undefined
        }
      />

      {abierto && <FormularioGrupo alCerrar={() => setAbierto(false)} />}

      {isLoading && <Vacio>Cargando…</Vacio>}

      {!isLoading && grupos?.length === 0 && (
        <div className="grid gap-5 border border-dashed border-gray-20 px-6 py-12 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-gray-45">
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
            className="block border border-ink transition-colors hover:bg-paper-dim"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-20 px-6 py-5">
              <div>
                <h3 className="text-[19px] leading-snug">{g.nombre}</h3>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.06em] text-gray-70">
                  {g.colegio} · Cuota {g.cuotaActual} de {g.cuotasTotales} ·
                  Vence {fecha(g.venceEl)}
                </div>
              </div>
              <div className="max-w-[260px]">
                <Tira
                  pagados={g.resumen.pagados}
                  pendientes={g.resumen.pendientes}
                  vencidos={g.resumen.vencidos}
                />
              </div>
            </div>

            <div className="flex flex-wrap">
              <Dato rotulo="Recaudado" valor={pesos(g.resumen.recaudado)} />
              <Dato rotulo="Esperado" valor={pesos(g.resumen.esperado)} />
              <Dato rotulo="Padres" valor={g.resumen.padres} />
              <Dato
                rotulo="Pagados"
                valor={`${g.resumen.pagados}/${g.resumen.padres}`}
              />
              <Dato rotulo="Vencidos" valor={g.resumen.vencidos} />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
