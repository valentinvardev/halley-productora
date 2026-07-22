"use client";

import Link from "next/link";
import { useState } from "react";

import { CampoFecha } from "~/app/_components/campo-fecha";
import { Marca } from "~/app/_components/marca";
import { Boton, Campo, Dato, Encabezado, Vacio } from "~/app/_components/ui";
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
        bajada="Cada grupo es un rollo: círculo con tilde es al día, punteado con saldo, tachado con cuotas vencidas."
        acciones={
          !abierto ? (
            <Boton onClick={() => setAbierto(true)}>Nuevo grupo</Boton>
          ) : undefined
        }
      />

      {abierto && <FormularioGrupo alCerrar={() => setAbierto(false)} />}

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
                <h3 className="text-[19px] leading-snug">{g.nombre}</h3>
                <div className="mt-1 font-rotulo text-[12px] uppercase tracking-[0.06em] text-gray-70">
                  {g.colegio} · {g.resumen.cuotas} cuotas ·{" "}
                  {g.resumen.alumnos} alumnos
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
