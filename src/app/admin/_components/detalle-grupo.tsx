"use client";

import Link from "next/link";
import { useState } from "react";

import { Copiar } from "~/app/_components/copiar";
import {
  IconoAlerta,
  IconoBillete,
  IconoCalendario,
  IconoLista,
  IconoMas,
  IconoObjetivo,
  IconoPuntos,
  IconoReloj,
  IconoSobre,
  IconoSobreReenvio,
  IconoTilde,
} from "~/app/_components/iconos";
import { Marca } from "~/app/_components/marca";
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
import { FotosGaleria } from "./fotos-galeria";

export function DetalleGrupo({ id }: { id: string }) {
  const utils = api.useUtils();
  const { data: grupo, isLoading } = api.grupo.detalle.useQuery(
    { id },
    // El pago entra por webhook: el panel tiene que verlo llegar solo.
    { refetchInterval: 2500 },
  );

  const [aviso, setAviso] = useState<string | null>(null);
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
          <>
            <Boton
              variante="fantasma"
              onClick={() => invitarTodos.mutate({ grupoId: id })}
              disabled={invitarTodos.isPending}
            >
              <IconoSobre />
              Invitar a todos
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

      <PlanDelGrupo cuotas={grupo.cuotas} />

      <CuentaDePago
        grupoId={id}
        actual={grupo.cuentaPago}
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

      <Galerias grupoId={id} galerias={grupo.galerias} alGuardar={refrescar} />

      {grupo.tipo !== "PARTICULAR" && (
        <AltaAlumnos grupoId={id} alTerminar={refrescar} />
      )}

      {grupo.alumnos.length === 0 ? (
        <Vacio>Todavía no hay alumnos cargados en este grupo</Vacio>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse border border-ink">
            <thead>
              <tr>
                {["Cuadro", "Alumno", "Alias", "Plan", "Cuotas", ""].map((h) => (
                  <th
                    key={h}
                    className="border-b border-ink px-3.5 py-2.5 text-left font-rotulo text-[11.5px] uppercase tracking-[0.05em] text-gray-70"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupo.alumnos.map((a, i) => (
                <tr key={a.id} className="border-b border-gray-20 last:border-b-0">
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
                    <span className="text-gray-45"> / {pesos(a.plan.total)}</span>
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

      {/* Queda siempre montado: si se desmontara al cerrar, el modal
          desaparecería de golpe en vez de irse con su animación. */}
      <AccionesAlumno
        alumno={gestionando}
        modoDemo={grupo.modoDemo}
        alCerrar={() => setGestionandoId(null)}
        alRefrescar={refrescar}
      />
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
}: {
  cuotas: { id: string; numero: number; monto: number; venceEl: Date }[];
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
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- galerías */

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
  actual: { id: string; nombre: string; proveedor: "TALO" | "MERCADOPAGO" } | null;
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
      <select
        value={actual?.id ?? ""}
        onChange={(e) =>
          asignar.mutate({
            id: grupoId,
            cuentaPagoId: e.target.value || null,
          })
        }
        disabled={asignar.isPending}
        className="border border-ink bg-lienzo px-3 py-[9px] text-[13px]"
      >
        <option value="">La de por defecto</option>
        {cuentas
          ?.filter((c) => c.activa)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} —{" "}
              {c.proveedor === "MERCADOPAGO" ? "Mercado Pago" : "Talo"} {c.pista}
            </option>
          ))}
      </select>
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

      {galerias.length === 0 && !abierto && (
        <Vacio>Sin galería asignada</Vacio>
      )}

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
            guardar.mutate({ grupoId, titulo, linkDrive: link, venceEl: vence });
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
  alTerminar,
}: {
  grupoId: string;
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
