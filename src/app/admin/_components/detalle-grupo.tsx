"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Copiar } from "~/app/_components/copiar";
import {
  IconoAlerta,
  IconoBillete,
  IconoCalendario,
  IconoLista,
  IconoMas,
  IconoObjetivo,
  IconoPapelera,
  IconoPuntos,
  IconoReloj,
  IconoSobre,
  IconoSobreReenvio,
  IconoTilde,
} from "~/app/_components/iconos";
import { Marca } from "~/app/_components/marca";
import { ItemAccion, MenuAcciones } from "~/app/_components/menu-acciones";
import { Desplegable } from "~/app/_components/desplegable";
import { Modal } from "~/app/_components/modal";
import {
  Boton,
  BotonTexto,
  Campo,
  CampoTexto,
  Dato,
  Encabezado,
  Etiqueta,
  Tag,
  TiraDatos,
  Vacio,
} from "~/app/_components/ui";
import { cuadro, fecha, fechaHora, pesos } from "~/lib/format";
import { api } from "~/trpc/react";
import { AccionesAlumno, type AlumnoAcciones } from "./acciones-alumno";
import { EsqueletoDetalle } from "./esqueletos";
import { AvisosGrupoAdmin } from "./avisos-grupo-admin";
import { FotosGaleria } from "./fotos-galeria";
import { GestionCuotas } from "./gestion-cuotas";
import { MontosDelGrupo } from "./montos-plan";

export function DetalleGrupo({ id }: { id: string }) {
  const utils = api.useUtils();
  const { data: grupo, isLoading } = api.grupo.detalle.useQuery(
    { id },
    // El pago entra por webhook: el panel tiene que verlo llegar solo.
    { refetchInterval: 2500 },
  );

  const router = useRouter();
  const [aviso, setAviso] = useState<string | null>(null);
  /** Si el cartel de borrar está abierto. */
  const [borrando, setBorrando] = useState(false);
  /** Si el modal de cuotas está abierto. */
  const [gestionandoCuotas, setGestionandoCuotas] = useState(false);
  const [editandoMontos, setEditandoMontos] = useState(false);
  /** Qué alumno tiene abierto el modal de acciones. */
  const [gestionandoId, setGestionandoId] = useState<string | null>(null);
  const refrescar = async (mensaje?: string) => {
    await utils.grupo.detalle.invalidate({ id });
    await utils.grupo.listar.invalidate();
    if (mensaje) {
      setAviso(mensaje);
      setTimeout(() => setAviso(null), 4000);
    }
  };

  // Se pide sólo con el cartel abierto: son cinco conteos que no hacen falta
  // mientras nadie esté por borrar nada.
  const { data: seBorra } = api.grupo.loQueSeBorra.useQuery(
    { id },
    { enabled: borrando },
  );

  const eliminar = api.grupo.eliminar.useMutation({
    onSuccess: () => {
      // Se vuelve al listado antes de invalidar: quedarse en el detalle de algo
      // que ya no existe deja la pantalla en un error.
      router.push("/admin");
      void utils.grupo.listar.invalidate();
    },
  });

  const invitarTodos = api.alumno.invitarTodos.useMutation({
    onSuccess: (r) =>
      refrescar(
        `Invitaciones enviadas: ${r.enviados}${r.sinEmail ? ` · sin email: ${r.sinEmail}` : ""}`,
      ),
  });
  const recordarPendientes = api.alumno.recordarPendientes.useMutation({
    onSuccess: (r) => refrescar(`Recordatorios enviados: ${r.enviados}`),
  });
  if (isLoading) return <EsqueletoDetalle />;
  if (!grupo) return <Vacio>No encontramos el grupo</Vacio>;

  // Se resuelve contra la lista en cada render y no se guarda una copia: la
  // consulta refresca sola cada 2,5s, y el modal tiene que ver el pago entrar
  // igual que la tabla. Si el alumno se elimina, esto da null y se cierra.
  const gestionando: AlumnoAcciones | null =
    grupo.alumnos.find((a) => a.id === gestionandoId) ?? null;

  return (
    <>
      <Link href="/admin" className="eyebrow mb-6 inline-block hover:text-ink">
        ← Grupos
      </Link>

      <Encabezado
        eyebrow={`${grupo.colegio} · ${grupo.cuotas.length} cuotas`}
        titulo={grupo.nombre}
        acciones={
          <MenuAcciones>
            <ItemAccion
              onClick={() => invitarTodos.mutate({ grupoId: id })}
              disabled={invitarTodos.isPending}
            >
              <IconoSobre />
              Invitar a todos
            </ItemAccion>
            <ItemAccion
              onClick={() => recordarPendientes.mutate({ grupoId: id })}
              disabled={recordarPendientes.isPending}
            >
              <IconoSobreReenvio />
              Recordar pendientes
            </ItemAccion>
            <ItemAccion onClick={() => setGestionandoCuotas(true)}>
              <IconoLista />
              Gestión de cuotas
            </ItemAccion>
            <ItemAccion onClick={() => setBorrando(true)}>
              <IconoPapelera />
              Eliminar evento
            </ItemAccion>
          </MenuAcciones>
        }
      />

      <TiraDatos className="mb-8">
        <Dato
          rotulo="Recaudado"
          valor={pesos(grupo.resumen.recaudado)}
          icono={<IconoBillete />}
        />
        <Dato
          rotulo="Plan total"
          valor={pesos(grupo.resumen.esperado)}
          icono={<IconoObjetivo />}
        />
        <Dato
          rotulo="Al día"
          valor={`${grupo.resumen.alDia}/${grupo.resumen.alumnos}`}
          icono={<IconoTilde />}
        />
        <Dato
          rotulo="Con saldo"
          valor={grupo.resumen.conDeuda}
          icono={<IconoReloj />}
        />
        <Dato
          rotulo="Con vencidas"
          valor={grupo.resumen.vencidos}
          icono={<IconoAlerta />}
        />
      </TiraDatos>

      {aviso && (
        <div className="nota mb-6 border border-ink bg-paper-dim px-4 py-3 text-ink">
          {aviso}
        </div>
      )}

      <PlanDelGrupo
        cuotas={grupo.cuotas}
        alEditar={() => setEditandoMontos(true)}
      />

      <CuentaDePago
        grupoId={id}
        actual={grupo.cuentaPago}
        alCambiar={refrescar}
      />

      <ModoPrueba
        grupoId={id}
        activo={grupo.modoPrueba}
        alCambiar={refrescar}
      />

      {grupo.autoRegistro && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border border-gray-20 bg-paper-dim px-4 py-3">
          <div>
            <div className="font-rotulo text-[11.5px] uppercase tracking-[0.08em] text-gray-45">
              Link de registro del grupo
            </div>
            <div className="nota text-[11.5px] text-gray-45">
              Es el que se le pasa a las familias
            </div>
            <div className="mt-1 font-mono text-[12px] break-all">
              {grupo.linkRegistro}
            </div>
          </div>
          <Copiar valor={grupo.linkRegistro} etiqueta="Copiar link" />
        </div>
      )}

      <AvisosGrupoAdmin grupoId={id} />

      <Galerias grupoId={id} galerias={grupo.galerias} alGuardar={refrescar} />

      {grupo.tipo !== "PARTICULAR" && (
        <AltaAlumnos
          grupoId={id}
          habilitado={grupo.puedeAltaDeAlumnos}
          alTerminar={refrescar}
        />
      )}

      {grupo.alumnos.length === 0 ? (
        <Vacio>Todavía no hay alumnos cargados en este grupo</Vacio>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse border border-ink">
            <thead>
              <tr>
                {["Cuadro", "Alumno", "Alias", "Plan", "Cuotas", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="border-b border-ink px-3.5 py-2.5 text-left font-rotulo text-[11.5px] uppercase tracking-[0.05em] text-gray-70"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {grupo.alumnos.map((a, i) => (
                <tr
                  key={a.id}
                  className="border-b border-gray-20 last:border-b-0"
                >
                  <td className="px-3.5 py-3 font-mono text-[12px] text-gray-45">
                    {cuadro(i)}
                  </td>

                  <td className="px-3.5 py-3">
                    <div className="text-[13.5px]">{a.nombre}</div>
                    {/* Los responsables registrados; si no hay ninguno, el
                        contacto que cargó el admin. */}
                    {a.responsables.length > 0 ? (
                      a.responsables.map((r) => (
                        <div
                          key={r.id}
                          className="nota text-[11.5px] text-gray-45"
                        >
                          {r.email}
                        </div>
                      ))
                    ) : (
                      <div className="nota text-[11.5px] text-gray-45">
                        {a.emailContacto ?? "sin email"}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {a.responsables.length > 0 ? (
                        <Tag activo>
                          {a.responsables.length} responsable
                          {a.responsables.length > 1 ? "s" : ""}
                        </Tag>
                      ) : (
                        <Tag>Sin cuenta</Tag>
                      )}
                    </div>
                  </td>

                  <td className="px-3.5 py-3">
                    <div className="font-mono text-[11.5px]">{a.alias}</div>
                    <div className="font-mono text-[10px] text-gray-45">
                      CVU {a.cvu}
                    </div>
                  </td>

                  <td className="px-3.5 py-3 font-mono text-[12.5px] whitespace-nowrap">
                    {pesos(a.plan.pagado)}
                    <span className="text-gray-45">
                      {" "}
                      / {pesos(a.plan.total)}
                    </span>
                    {a.plan.deuda > 0 && (
                      <div className="text-[10.5px] text-gray-45">
                        debe {pesos(a.plan.deuda)}
                      </div>
                    )}
                    {a.plan.aFavor > 0 && (
                      <div className="text-[10.5px] text-gray-45">
                        a favor {pesos(a.plan.aFavor)}
                      </div>
                    )}
                  </td>

                  {/* Una marca por cuota: el plan entero de un vistazo. */}
                  <td className="px-3.5 py-3">
                    <div className="flex gap-1">
                      {a.plan.cuotas.map((c) => (
                        <Marca
                          key={c.id}
                          tipo={
                            c.estado === "PAGADA"
                              ? "confirmado"
                              : c.estado === "VENCIDA"
                                ? "tachado"
                                : "punteado"
                          }
                          className="h-4 w-4"
                          grosor={c.estado === "PAGADA" ? 4 : 5}
                          color={
                            c.estado === "PENDIENTE"
                              ? "var(--color-gray-45)"
                              : "var(--color-ink)"
                          }
                        />
                      ))}
                    </div>
                    {a.plan.proxima && (
                      <div className="mt-1 font-mono text-[10px] text-gray-45">
                        próxima: {a.plan.proxima.numero} ·{" "}
                        {fecha(a.plan.proxima.venceEl)}
                      </div>
                    )}
                    {a.pagos[0] && (
                      <div className="font-mono text-[10px] text-gray-45">
                        último pago {fechaHora(a.pagos[0].recibidoEn)}
                      </div>
                    )}
                  </td>

                  {/* Una sola puerta: todo lo que se puede hacer con este
                      alumno vive en el modal, no desparramado en la fila. */}
                  <td className="px-3.5 py-3 text-right">
                    <button
                      onClick={() => setGestionandoId(a.id)}
                      className="inline-flex cursor-pointer items-center gap-2 border border-ink px-3 py-2 font-rotulo text-[11.5px] uppercase tracking-[0.05em] hover:bg-ink hover:text-paper"
                    >
                      <IconoPuntos />
                      Acciones
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MontosDelGrupo
        abierto={editandoMontos}
        alCerrar={() => setEditandoMontos(false)}
        cuotas={grupo.cuotas}
        conPrecioPropio={
          grupo.alumnos.filter((a) => a.ajustes.length > 0).length
        }
        alRefrescar={refrescar}
      />

      {/* Queda siempre montado: si se desmontara al cerrar, el modal
          desaparecería de golpe en vez de irse con su animación. */}
      <AccionesAlumno
        alumno={gestionando}
        modoDemo={grupo.modoDemo}
        alCerrar={() => setGestionandoId(null)}
        alRefrescar={refrescar}
      />

      <GestionCuotas
        abierto={gestionandoCuotas}
        alCerrar={() => setGestionandoCuotas(false)}
        grupoNombre={grupo.nombre}
        totalCuotas={grupo.cuotas.length}
        // Cada alumno viaja con su plan ya imputado, que es lo que le permite al
        // modal mostrar cuánto debe cada uno y sumar el total exacto de lo que se
        // va a registrar sin volver a preguntar.
        alumnos={grupo.alumnos.map((a) => ({
          id: a.id,
          nombre: a.nombre,
          deuda: a.plan.deuda,
          cuotas: a.plan.cuotas.map((c) => ({
            numero: c.numero,
            saldo: c.saldo,
          })),
          // Los marcados a mano se reconocen por el prefijo de la referencia, y
          // son los únicos que se pueden deshacer: un pago de Talo o de Mercado
          // Pago entró de verdad y borrarlo dejaría al panel mintiendo.
          manual: a.pagos
            .filter((p) => p.refPago.startsWith("manual:"))
            .reduce(
              (t, p) => ({
                cantidad: t.cantidad + 1,
                total: t.total + p.monto,
              }),
              { cantidad: 0, total: 0 },
            ),
        }))}
        alRefrescar={refrescar}
      />

      {/* El cartel dice números y no una advertencia genérica. Lo que frena a
          alguien de borrar lo que no quería es leer "23 alumnos, 41 pagos", no
          leer que la acción es irreversible. */}
      <Modal
        abierto={borrando}
        alCerrar={() => setBorrando(false)}
        eyebrow="Eliminar"
        titulo={grupo.nombre}
      >
        <p className="text-[14px] leading-relaxed text-gray-70">
          Se borra el evento completo y no se puede deshacer. Con él se van:
        </p>
        <ul className="mt-4 space-y-1.5 text-[14px]">
          {(
            [
              ["alumnos cargados", seBorra?.alumnos],
              ["pagos registrados", seBorra?.pagos],
              ["galerías", seBorra?.galerias],
              ["fotos y videos entregados", seBorra?.fotos],
              ["avisos enviados", seBorra?.avisos],
            ] as const
          ).map(([que, cuantos]) => (
            <li key={que} className="flex justify-between gap-4">
              <span className="text-gray-70">{que}</span>
              <span className="font-display tabular-nums">
                {cuantos ?? "—"}
              </span>
            </li>
          ))}
        </ul>
        <p className="nota mt-4">
          El historial de cobros de estas familias deja de existir. Si sólo
          querés dejar de usarlo, alcanza con no invitarlo más.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Boton variante="fantasma" onClick={() => setBorrando(false)}>
            Cancelar
          </Boton>
          <button
            type="button"
            onClick={() => eliminar.mutate({ id })}
            disabled={eliminar.isPending}
            className="inline-flex items-center gap-2 border border-marca bg-marca px-[22px] py-[13px] font-rotulo text-[13px] uppercase tracking-[0.04em] text-paper transition-colors hover:bg-transparent hover:text-marca disabled:opacity-40"
          >
            <IconoPapelera />
            {eliminar.isPending ? "Eliminando…" : "Eliminar evento"}
          </button>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------ plan del grupo */

/**
 * El plan en una sola tarjeta.
 *
 * Antes había una tarjetita por cuota: seis cajas repitiendo el mismo monto y
 * el mismo día del mes, con el ojo saltando de una a otra para reconstruir lo
 * que en realidad es una frase. El plan casi siempre es regular, así que se
 * dice de una: "6 cuotas de $45.000, el 10 de cada mes".
 *
 * Cuando no es regular —montos distintos— no se inventa uniformidad: se dice
 * el rango y se aclara.
 */
function PlanDelGrupo({
  cuotas,
  alEditar,
}: {
  cuotas: { id: string; numero: number; monto: number; venceEl: Date }[];
  alEditar: () => void;
}) {
  const primera = cuotas[0];
  const ultima = cuotas[cuotas.length - 1];
  if (!primera || !ultima) return null;

  const montos = cuotas.map((c) => c.monto);
  const minimo = Math.min(...montos);
  const maximo = Math.max(...montos);
  const uniforme = minimo === maximo;
  const total = montos.reduce((t, m) => t + m, 0);

  // ¿Caen siempre el mismo día del mes? Es lo habitual y se dice mucho mejor
  // que repetir seis fechas.
  const dias = new Set(cuotas.map((c) => c.venceEl.getDate()));
  const diaFijo = dias.size === 1 ? primera.venceEl.getDate() : null;

  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-6 border border-ink px-6 py-5">
      <div>
        <div className="eyebrow flex items-center gap-1.5">
          <IconoCalendario />
          Plan de cuotas
        </div>

        <div className="mt-2.5 font-display text-[30px] leading-none">
          {cuotas.length} {cuotas.length === 1 ? "cuota" : "cuotas"}
          {uniforme && ` de ${pesos(minimo)}`}
        </div>

        <p className="nota mt-2.5 max-w-[52ch]">
          {diaFijo
            ? `Vencen el ${diaFijo} de cada mes, de ${fecha(primera.venceEl)} a ${fecha(ultima.venceEl)}.`
            : `La primera vence el ${fecha(primera.venceEl)} y la última el ${fecha(ultima.venceEl)}.`}
          {!uniforme &&
            ` Los montos van de ${pesos(minimo)} a ${pesos(maximo)}.`}
        </p>
      </div>

      <div className="text-right">
        <div className="font-rotulo text-[11.5px] uppercase tracking-[0.08em] text-gray-45">
          Total por alumno
        </div>
        <div className="mt-1.5 font-display text-[26px] leading-none">
          {pesos(total)}
        </div>
        {/* "Por alumno" es el del curso: el que tenga precio propio paga otra
            cosa, y ése se edita desde su ficha. */}
        <button
          type="button"
          onClick={alEditar}
          className="mt-2 cursor-pointer font-rotulo text-[11px] tracking-[0.06em] text-gray-45 uppercase underline underline-offset-4 hover:text-ink"
        >
          Editar montos
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- galerías */

/**
 * El interruptor de modo prueba.
 *
 * Con esto encendido los pagos del grupo se simulan y no tocan a ningún
 * proveedor: sirve para ensayar el circuito entero —que la cuota se marque, que
 * salga el email, que se destrabe la galería— sin mover un peso.
 *
 * Se avisa fuerte, y la familia también lo ve en su pantalla: un cobro de
 * mentira que se parece a uno real es una trampa esperando.
 */
function ModoPrueba({
  grupoId,
  activo,
  alCambiar,
}: {
  grupoId: string;
  activo: boolean;
  alCambiar: (mensaje?: string) => Promise<void>;
}) {
  const cambiar = api.grupo.modoPrueba.useMutation({
    onSuccess: () =>
      alCambiar(activo ? "Modo prueba apagado" : "Modo prueba encendido"),
  });

  return (
    <div
      className={`mb-8 flex flex-wrap items-center justify-between gap-3 border px-4 py-3 ${
        activo ? "border-marca bg-marca/5" : "border-gray-20 bg-paper-dim"
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Etiqueta>Modo prueba</Etiqueta>
          {activo && <Tag>Encendido</Tag>}
        </div>
        <div className="nota mt-0.5 max-w-[70ch] text-[11.5px] text-gray-45">
          {activo
            ? "Los pagos de este grupo se simulan: no llega plata de verdad y la familia ve que está en prueba."
            : "Encendelo para ensayar el circuito completo sin mover un peso. Los demás grupos siguen cobrando normal."}
        </div>
      </div>
      <Boton
        variante={activo ? "solido" : "fantasma"}
        onClick={() => cambiar.mutate({ id: grupoId, activo: !activo })}
        disabled={cambiar.isPending}
      >
        {cambiar.isPending ? "Cambiando…" : activo ? "Apagar" : "Encender"}
      </Boton>
    </div>
  );
}

/**
 * A qué cuenta van los cobros de este grupo. Es lo que enruta una boda a la
 * cuenta del socio que la trabaja, o deja al grupo con la de por defecto. Cerrar
 * esto era lo último que faltaba para que el ruteo de pagos se use sin tocar la
 * base a mano.
 */
function CuentaDePago({
  grupoId,
  actual,
  alCambiar,
}: {
  grupoId: string;
  actual: {
    id: string;
    nombre: string;
    proveedor: "TALO" | "MERCADOPAGO";
  } | null;
  alCambiar: (mensaje?: string) => Promise<void>;
}) {
  const { data: cuentas } = api.cuentaPago.listar.useQuery();
  const asignar = api.grupo.asignarCuenta.useMutation({
    onSuccess: () => alCambiar("Cuenta de cobro actualizada"),
  });

  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border border-gray-20 bg-paper-dim px-4 py-3">
      <div>
        <Etiqueta>Cuenta que cobra</Etiqueta>
        <div className="nota mt-0.5 text-[11.5px] text-gray-45">
          {actual
            ? `${actual.nombre} · ${actual.proveedor === "MERCADOPAGO" ? "Mercado Pago" : "Talo"}`
            : "La de por defecto"}
        </div>
      </div>
      <Desplegable
        compacto
        placeholder="La de por defecto"
        valor={actual?.id ?? ""}
        deshabilitado={asignar.isPending}
        alCambiar={(v) =>
          asignar.mutate({ id: grupoId, cuentaPagoId: v || null })
        }
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
    </div>
  );
}

function Galerias({
  grupoId,
  galerias,
  alGuardar,
}: {
  grupoId: string;
  galerias: {
    id: string;
    titulo: string;
    linkDrive: string | null;
    venceEl: Date | null;
  }[];
  alGuardar: (mensaje?: string) => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [link, setLink] = useState("");

  const guardar = api.grupo.guardarGaleria.useMutation({
    onSuccess: async () => {
      setTitulo("");
      setLink("");
      setAbierto(false);
      await alGuardar("Galería guardada");
    },
  });
  const eliminar = api.grupo.eliminarGaleria.useMutation({
    onSuccess: () => alGuardar("Galería eliminada"),
  });

  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between">
        <div className="eyebrow">Galería del grupo</div>
        {!abierto && (
          <BotonTexto onClick={() => setAbierto(true)}>
            <IconoMas />
            Agregar galería
          </BotonTexto>
        )}
      </div>

      {galerias.length === 0 && !abierto && <Vacio>Sin galería asignada</Vacio>}

      {galerias.map((g) => (
        <div key={g.id} className="mb-2 border border-gray-20 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[13.5px]">{g.titulo}</div>
              <div className="font-mono text-[11px] text-gray-45 break-all">
                {g.linkDrive ?? "sin link de Drive"}
                {g.venceEl && ` · vence ${fecha(g.venceEl)}`}
              </div>
            </div>
            <BotonTexto
              onClick={() => eliminar.mutate({ id: g.id })}
              className="text-gray-45"
            >
              Eliminar
            </BotonTexto>
          </div>
          <FotosGaleria galeriaId={g.id} />
        </div>
      ))}

      {abierto && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const vence = new Date();
            vence.setFullYear(vence.getFullYear() + 1);
            guardar.mutate({
              grupoId,
              titulo,
              linkDrive: link,
              venceEl: vence,
            });
          }}
          className="grid gap-4 border border-ink p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="Título"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Sesión de fotos — Egresados 2027"
              required
            />
            <Campo
              label="Link de Drive"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://drive.google.com/..."
              hint="Se publica un año. Después queda como respaldo."
            />
          </div>
          <div className="flex gap-3">
            <Boton type="submit" disabled={guardar.isPending}>
              Guardar galería
            </Boton>
            <Boton
              type="button"
              variante="fantasma"
              onClick={() => setAbierto(false)}
            >
              Cancelar
            </Boton>
          </div>
        </form>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- alta */

function AltaAlumnos({
  grupoId,
  habilitado,
  alTerminar,
}: {
  grupoId: string;
  /** Si el grupo tiene de dónde sacar credenciales para pedir el CVU. */
  habilitado: boolean;
  alTerminar: (mensaje?: string) => Promise<void>;
}) {
  const [modo, setModo] = useState<"cerrado" | "uno" | "bloque">("cerrado");

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [texto, setTexto] = useState("");

  const agregar = api.alumno.agregar.useMutation({
    onSuccess: async (r) => {
      setNombre("");
      setEmail("");
      await alTerminar(
        r.yaExistia ? "Ese alumno ya estaba en el grupo" : "Alumno agregado",
      );
    },
  });

  const enBloque = api.alumno.agregarEnBloque.useMutation({
    onSuccess: async (r) => {
      setTexto("");
      setModo("cerrado");
      await alTerminar(
        `Cargados: ${r.creados} · Repetidos: ${r.repetidos} · Con error: ${r.errores.length}`,
      );
    },
  });

  /**
   * Sin cuenta que cobre no se puede dar de alta a nadie.
   *
   * Cargar un alumno le pide un CVU propio a Talo antes de escribir nada en la
   * base, así que sin credenciales el alta falla entera: no se crea el alumno y
   * tampoco sale su invitación. Eso llegaba al panel como un error suelto, que
   * se lee como "se rompió" y no como "falta configurar esto" — y encima no
   * decía dónde se configura.
   *
   * Se avisa antes y en lugar del formulario. Ofrecer un formulario que no
   * puede funcionar es hacer escribir un nombre para después tirarlo.
   */
  if (!habilitado) {
    return (
      <div className="mb-8 border border-marca p-5">
        <div className="flex items-center gap-2 font-rotulo text-[12px] tracking-[0.06em] text-marca uppercase">
          <IconoAlerta />
          Falta la cuenta que cobra
        </div>
        <p className="nota mt-2 max-w-[62ch]">
          Este grupo no tiene una cuenta de Talo asignada, y tampoco hay una
          marcada como <strong className="font-normal text-ink">por
          defecto</strong> que esté activa. Cada alumno necesita su propio CVU
          para poder cobrarle, y ese CVU lo emite la cuenta — sin una, no se
          puede dar de alta a nadie.
        </p>
        <p className="nota mt-2 max-w-[62ch]">
          Asignale una arriba, en <strong className="font-normal text-ink">
          Cuenta que cobra</strong>, o marcá una como por defecto en{" "}
          <Link href="/admin/cuentas" className="underline underline-offset-2">
            Cuentas de pago
          </Link>
          .
        </p>
      </div>
    );
  }

  if (modo === "cerrado") {
    return (
      <div className="mb-8 flex gap-3">
        <Boton onClick={() => setModo("uno")}>
          <IconoMas />
          Agregar alumno
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
          className={`font-rotulo text-[12px] uppercase tracking-[0.06em] ${modo === "uno" ? "text-ink underline" : "text-gray-45"}`}
        >
          Uno por uno
        </button>
        <button
          onClick={() => setModo("bloque")}
          className={`font-rotulo text-[12px] uppercase tracking-[0.06em] ${modo === "bloque" ? "text-ink underline" : "text-gray-45"}`}
        >
          En bloque
        </button>
      </div>

      {modo === "uno" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            agregar.mutate({
              grupoId,
              nombre,
              emailContacto: email,
              invitar: true,
            });
          }}
          className="grid gap-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="Nombre del alumno"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Fernando Ríos"
              required
            />
            <Campo
              label="Email de la familia (opcional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="familia@mail.com"
              hint="Se usa para mandarle la invitación a registrarse."
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
            label="Un alumno por línea"
            hint="Formato: nombre, email de la familia (el email es opcional). También acepta punto y coma o tabulación."
            rows={7}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={"Fernando Ríos, familia.rios@mail.com\nCarla Pérez"}
            required
          />
          <div className="flex gap-3">
            <Boton type="submit" disabled={enBloque.isPending}>
              {enBloque.isPending ? "Creando en Talo…" : "Cargar e invitar"}
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
