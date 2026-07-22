"use client";

import Link from "next/link";
import { useState } from "react";

import { Copiar } from "~/app/_components/copiar";
import {
  IconoLista,
  IconoMas,
  IconoSobre,
  IconoSobreReenvio,
} from "~/app/_components/iconos";
import { EstadoCobro } from "~/app/_components/marca";
import {
  Boton,
  BotonTexto,
  Campo,
  CampoTexto,
  Dato,
  Encabezado,
  Tag,
  Vacio,
} from "~/app/_components/ui";
import { cuadro, fecha, fechaHora, pesos } from "~/lib/format";
import { api } from "~/trpc/react";

export function DetalleGrupo({ id }: { id: string }) {
  const utils = api.useUtils();
  const { data: grupo, isLoading } = api.grupo.detalle.useQuery(
    { id },
    // El pago entra por webhook: el panel tiene que verlo llegar solo.
    { refetchInterval: 2500 },
  );

  const [aviso, setAviso] = useState<string | null>(null);
  const refrescar = async (mensaje?: string) => {
    await utils.grupo.detalle.invalidate({ id });
    await utils.grupo.listar.invalidate();
    if (mensaje) {
      setAviso(mensaje);
      setTimeout(() => setAviso(null), 4000);
    }
  };

  const invitarPendientes = api.padre.invitarPendientes.useMutation({
    onSuccess: (r) => refrescar(`Invitaciones enviadas: ${r.enviados}`),
  });
  const recordarPendientes = api.padre.recordarPendientes.useMutation({
    onSuccess: (r) => refrescar(`Recordatorios enviados: ${r.enviados}`),
  });
  const invitar = api.padre.invitar.useMutation({
    onSuccess: () => refrescar("Invitación enviada"),
  });
  const recordar = api.padre.recordar.useMutation({
    onSuccess: () => refrescar("Recordatorio enviado"),
  });
  const eliminar = api.padre.eliminar.useMutation({
    onSuccess: () => refrescar("Padre eliminado"),
  });
  const simular = api.pago.simular.useMutation({
    onSuccess: async () => {
      await refrescar("Transferencia simulada — esperando el webhook…");
      // El webhook se procesa después de responderle 200 a Talo, así que al
      // volver de la mutación el pago todavía no está. Insistimos un par de
      // veces para que la fila se marque enseguida y no en el próximo ciclo.
      setTimeout(() => void refrescar(), 700);
      setTimeout(() => void refrescar(), 1800);
    },
  });

  if (isLoading) return <Vacio>Cargando…</Vacio>;
  if (!grupo) return <Vacio>No encontramos el grupo</Vacio>;

  const ocupado =
    invitar.isPending ||
    recordar.isPending ||
    simular.isPending ||
    eliminar.isPending;

  return (
    <>
      <Link
        href="/admin"
        className="eyebrow mb-6 inline-block hover:text-ink"
      >
        ← Grupos
      </Link>

      <Encabezado
        eyebrow={`${grupo.colegio} · Cuota ${grupo.cuotaActual} de ${grupo.cuotasTotales} · Vence ${fecha(grupo.venceEl)}`}
        titulo={grupo.nombre}
        acciones={
          <>
            <Boton
              variante="fantasma"
              onClick={() =>
                invitarPendientes.mutate({ grupoId: id, soloNoInvitados: true })
              }
              disabled={invitarPendientes.isPending}
            >
              <IconoSobre />
              Invitar no invitados
            </Boton>
            <Boton
              variante="fantasma"
              onClick={() => recordarPendientes.mutate({ grupoId: id })}
              disabled={recordarPendientes.isPending}
            >
              <IconoSobreReenvio />
              Recordar pendientes
            </Boton>
          </>
        }
      />

      <div className="mb-8 flex flex-wrap border border-ink">
        <Dato rotulo="Recaudado" valor={pesos(grupo.resumen.recaudado)} />
        <Dato rotulo="Esperado" valor={pesos(grupo.resumen.esperado)} />
        <Dato
          rotulo="Pagados"
          valor={`${grupo.resumen.pagados}/${grupo.resumen.padres}`}
        />
        <Dato rotulo="Pendientes" valor={grupo.resumen.pendientes} />
        <Dato rotulo="Vencidos" valor={grupo.resumen.vencidos} />
      </div>

      {aviso && (
        <div className="mb-6 border border-ink bg-paper-dim px-4 py-3 font-mono text-[11px] uppercase tracking-[0.06em]">
          {aviso}
        </div>
      )}

      {grupo.autoRegistro && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border border-gray-20 bg-paper-dim px-4 py-3">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-gray-45">
              Link de auto-registro del grupo
            </div>
            <div className="mt-1 font-mono text-[12px] break-all">
              {grupo.linkRegistro}
            </div>
          </div>
          <Copiar valor={grupo.linkRegistro} etiqueta="Copiar link" />
        </div>
      )}

      <AltaPadres grupoId={id} alTerminar={refrescar} />

      {grupo.padres.length === 0 ? (
        <Vacio>Todavía no hay padres cargados en este grupo</Vacio>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse border border-ink">
            <thead>
              <tr>
                {["Cuadro", "Padre", "Alias", "Monto", "Estado", ""].map((h) => (
                  <th
                    key={h}
                    className="border-b border-ink px-3.5 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-[0.05em] text-gray-70"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupo.padres.map((p, i) => (
                <tr key={p.id} className="border-b border-gray-20 last:border-b-0">
                  <td className="px-3.5 py-3 font-mono text-[12px] text-gray-45">
                    {cuadro(i)}
                  </td>

                  <td className="px-3.5 py-3">
                    <div className="text-[13.5px]">{p.nombre}</div>
                    <div className="font-mono text-[10.5px] text-gray-45">
                      {p.email}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {p.origen === "AUTO_REGISTRO" && <Tag>Se anotó solo</Tag>}
                      {!p.invitadoEl && <Tag>Sin invitar</Tag>}
                      {p.reportoTransferenciaEl && p.estado !== "PAGADO" && (
                        <Tag activo>Dice que transfirió</Tag>
                      )}
                    </div>
                  </td>

                  <td className="px-3.5 py-3">
                    <div className="font-mono text-[11.5px]">{p.alias}</div>
                    <div className="font-mono text-[10px] text-gray-45">
                      CVU {p.cvu}
                    </div>
                  </td>

                  <td className="px-3.5 py-3 font-mono text-[13px] whitespace-nowrap">
                    {pesos(p.monto)}
                    {p.tieneMontoPropio && (
                      <span className="ml-1 text-[10px] text-gray-45">·ajustado</span>
                    )}
                  </td>

                  <td className="px-3.5 py-3">
                    <EstadoCobro estado={p.estado} />
                    {p.pagos[0] && (
                      <div className="mt-1 font-mono text-[10px] text-gray-45">
                        {fechaHora(p.pagos[0].recibidoEn)}
                      </div>
                    )}
                  </td>

                  <td className="px-3.5 py-3">
                    <div className="flex flex-wrap justify-end gap-x-3 gap-y-1.5">
                      <Copiar valor={p.link} etiqueta="Link" />
                      <BotonTexto
                        onClick={() => invitar.mutate({ padreId: p.id })}
                        disabled={ocupado}
                      >
                        Invitar
                      </BotonTexto>
                      {p.estado !== "PAGADO" && (
                        <BotonTexto
                          onClick={() => recordar.mutate({ padreId: p.id })}
                          disabled={ocupado}
                        >
                          Recordar
                        </BotonTexto>
                      )}
                      {grupo.modoDemo && p.estado !== "PAGADO" && (
                        <BotonTexto
                          onClick={() => simular.mutate({ padreId: p.id })}
                          disabled={ocupado}
                        >
                          Simular pago
                        </BotonTexto>
                      )}
                      <BotonTexto
                        onClick={() => {
                          if (confirm(`¿Eliminar a ${p.nombre}?`)) {
                            eliminar.mutate({ padreId: p.id });
                          }
                        }}
                        disabled={ocupado}
                        className="text-gray-45"
                      >
                        Eliminar
                      </BotonTexto>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ alta */

function AltaPadres({
  grupoId,
  alTerminar,
}: {
  grupoId: string;
  alTerminar: (mensaje?: string) => Promise<void>;
}) {
  const [modo, setModo] = useState<"cerrado" | "uno" | "bloque">("cerrado");

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [texto, setTexto] = useState("");

  const agregar = api.padre.agregar.useMutation({
    onSuccess: async (r) => {
      setNombre("");
      setEmail("");
      await alTerminar(
        r.yaExistia ? "Ese email ya estaba en el grupo" : "Padre agregado e invitado",
      );
    },
  });

  const enBloque = api.padre.agregarEnBloque.useMutation({
    onSuccess: async (r) => {
      setTexto("");
      setModo("cerrado");
      await alTerminar(
        `Cargados: ${r.creados} · Repetidos: ${r.repetidos} · Con error: ${r.errores.length}`,
      );
    },
  });

  if (modo === "cerrado") {
    return (
      <div className="mb-8 flex gap-3">
        <Boton onClick={() => setModo("uno")}>
          <IconoMas />
          Agregar padre
        </Boton>
        <Boton variante="fantasma" onClick={() => setModo("bloque")}>
          <IconoLista />
          Cargar lista en bloque
        </Boton>
      </div>
    );
  }

  return (
    <div className="mb-8 border border-ink p-6">
      <div className="mb-4 flex gap-4">
        <button
          onClick={() => setModo("uno")}
          className={`font-mono text-[11px] uppercase tracking-[0.06em] ${modo === "uno" ? "text-ink underline" : "text-gray-45"}`}
        >
          Uno por uno
        </button>
        <button
          onClick={() => setModo("bloque")}
          className={`font-mono text-[11px] uppercase tracking-[0.06em] ${modo === "bloque" ? "text-ink underline" : "text-gray-45"}`}
        >
          En bloque
        </button>
      </div>

      {modo === "uno" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            agregar.mutate({ grupoId, nombre, email, invitar: true });
          }}
          className="grid gap-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="Nombre y apellido"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Fernando Ríos"
              required
            />
            <Campo
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="fernando@mail.com"
              required
            />
          </div>
          <div className="flex gap-3">
            <Boton type="submit" disabled={agregar.isPending}>
              {agregar.isPending ? "Creando en Talo…" : "Agregar e invitar"}
            </Boton>
            <Boton
              type="button"
              variante="fantasma"
              onClick={() => setModo("cerrado")}
            >
              Cerrar
            </Boton>
          </div>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enBloque.mutate({ grupoId, texto, invitar: true });
          }}
          className="grid gap-4"
        >
          <CampoTexto
            label="Un padre por línea"
            hint="Formato: nombre, email — también acepta punto y coma o tabulación (pegado desde Excel)."
            rows={7}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={"Fernando Ríos, fernando@mail.com\nCarla Pérez, carla@mail.com"}
            required
          />
          <div className="flex gap-3">
            <Boton type="submit" disabled={enBloque.isPending}>
              {enBloque.isPending ? "Creando en Talo…" : "Cargar e invitar a todos"}
            </Boton>
            <Boton
              type="button"
              variante="fantasma"
              onClick={() => setModo("cerrado")}
            >
              Cerrar
            </Boton>
          </div>
        </form>
      )}
    </div>
  );
}
