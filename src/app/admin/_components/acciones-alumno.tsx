"use client";

import { useRef, useState, type ReactNode } from "react";

import { Ayuda } from "~/app/_components/ayuda";
import { Copiar } from "~/app/_components/copiar";
import {
  IconoCampana,
  IconoPapelera,
  IconoProbeta,
  IconoSobre,
} from "~/app/_components/iconos";
import { Modal } from "~/app/_components/modal";
import {
  PlanCuotas,
  type CuotaVista,
} from "~/app/_components/plan-cuotas";
import { Boton, BotonTexto, Campo, Dato, TiraDatos } from "~/app/_components/ui";
import { fechaHora, pesos } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * Todo lo que se puede hacer con un alumno, en un solo lugar.
 *
 * Antes vivía como una fila de seis o siete botones de texto dentro de la
 * tabla: se comía el ancho, obligaba a leer para encontrar el que hacía falta
 * y el destructivo estaba a un pixel del inocente. Acá cada acción va en su
 * bloque, y las que no tienen vuelta atrás quedan abajo de todo y piden
 * confirmación en el mismo botón.
 */

export type AlumnoAcciones = {
  id: string;
  nombre: string;
  emailContacto: string | null;
  linkRegistro: string;
  linkPago: string;
  responsables: { id: string; email: string }[];
  plan: {
    total: number;
    pagado: number;
    deuda: number;
    aFavor: number;
    cuotas: CuotaVista[];
    proxima: { id: string } | null;
  };
  pagos: {
    id: string;
    monto: number;
    recibidoEn: Date;
    taloTransactionId: string;
  }[];
};

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="border-t border-gray-20 pt-4 first:border-t-0 first:pt-0">
      <div className="eyebrow mb-2.5">{titulo}</div>
      {children}
    </section>
  );
}

/** Una fila de enlace: qué es, la URL entera y el botón de copiar. */
function Enlace({
  titulo,
  nota,
  valor,
}: {
  titulo: string;
  nota: string;
  valor: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border border-gray-20 px-3.5 py-3">
      <div className="min-w-0">
        <div className="text-[13px]">{titulo}</div>
        <div className="nota text-[11.5px] text-gray-45">{nota}</div>
        <div className="mt-1.5 font-mono text-[10.5px] text-gray-45 break-all">
          {valor}
        </div>
      </div>
      <Copiar valor={valor} etiqueta="Copiar" className="shrink-0" />
    </div>
  );
}

export function AccionesAlumno({
  alumno,
  modoDemo,
  alCerrar,
  alRefrescar,
}: {
  /** `null` cierra el modal: es el alumno que se está gestionando. */
  alumno: AlumnoAcciones | null;
  modoDemo: boolean;
  alCerrar: () => void;
  alRefrescar: (mensaje?: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  /** Qué acción irreversible está esperando el segundo clic. */
  const [confirmando, setConfirmando] = useState<string | null>(null);

  // El último alumno mostrado sobrevive al cierre. Sin esto el modal se
  // vaciaría de golpe y la animación de salida correría sobre una caja en
  // blanco.
  const ultimo = useRef(alumno);
  if (alumno) ultimo.current = alumno;
  const datos = alumno ?? ultimo.current;

  // Cada vez que se abre se empieza limpio: sin el email a medio escribir ni
  // el aviso de la vez anterior. Ajustar estado durante el render es la forma
  // que React recomienda para esto — un efecto pintaría primero lo viejo.
  const [estabaAbierto, setEstabaAbierto] = useState(!!alumno);
  if (!!alumno !== estabaAbierto) {
    setEstabaAbierto(!!alumno);
    if (alumno) {
      setEmail("");
      setMensaje(null);
      setConfirmando(null);
    }
  }

  const avisar = async (texto: string) => {
    setMensaje(texto);
    await alRefrescar();
  };

  const invitar = api.alumno.invitar.useMutation({
    onSuccess: async (r) => {
      setEmail("");
      await avisar(
        r.enviado
          ? "Invitación enviada"
          : "No hay a quién escribirle — cargá un email",
      );
    },
    onError: (e) => setMensaje(e.message),
  });

  const recordar = api.alumno.recordar.useMutation({
    onSuccess: (r) =>
      avisar(r.enviado ? "Recordatorio enviado" : "No hay nada que recordar"),
  });

  const simular = api.pago.simular.useMutation({
    onSuccess: async () => {
      await avisar("Transferencia simulada — esperando el webhook…");
      // El webhook se procesa después de responderle 200 a Talo, así que al
      // volver de la mutación el pago todavía no está.
      setTimeout(() => void alRefrescar(), 700);
      setTimeout(() => void alRefrescar(), 1800);
    },
  });

  const desvincular = api.alumno.desvincular.useMutation({
    onSuccess: () => avisar("Responsable desvinculado"),
  });

  const eliminar = api.alumno.eliminar.useMutation({
    onSuccess: async () => {
      cerrar();
      await alRefrescar("Alumno eliminado");
    },
  });

  const ocupado =
    invitar.isPending ||
    recordar.isPending ||
    simular.isPending ||
    desvincular.isPending ||
    eliminar.isPending;

  // Cerrar no limpia nada: el contenido tiene que seguir en pantalla mientras
  // dura la animación de salida. La limpieza pasa al volver a abrir.
  const cerrar = alCerrar;

  if (!datos) return null;

  /** Botón que pide un segundo clic antes de hacer algo sin vuelta atrás. */
  const confirmar = (clave: string, accion: () => void) => () => {
    if (confirmando === clave) {
      setConfirmando(null);
      accion();
    } else {
      setConfirmando(clave);
    }
  };

  return (
    <Modal
      abierto={!!alumno}
      alCerrar={cerrar}
      eyebrow="Acciones"
      titulo={datos.nombre}
    >
      <div className="grid gap-5">
        {mensaje && (
          <p className="nota border border-ink bg-paper-dim px-3.5 py-2.5 text-ink">
            {mensaje}
          </p>
        )}

        {/* Primero el estado, después las acciones: recordar o simular se
            deciden mirando esto, no al revés. */}
        <Seccion titulo="Estado del plan">
          <TiraDatos>
            <Dato rotulo="Pagado" valor={pesos(datos.plan.pagado)} />
            <Dato
              rotulo="Falta"
              valor={pesos(datos.plan.deuda)}
              detalle={
                datos.plan.deuda === 0
                  ? "Plan completo"
                  : `de ${pesos(datos.plan.total)}`
              }
            />
            {datos.plan.aFavor > 0 && (
              <Dato rotulo="A favor" valor={pesos(datos.plan.aFavor)} />
            )}
          </TiraDatos>

          <div className="mt-3">
            <PlanCuotas
              cuotas={datos.plan.cuotas}
              destacar={datos.plan.proxima?.id}
            />
          </div>
        </Seccion>

        <Seccion titulo="Transferencias recibidas">
          {datos.pagos.length === 0 ? (
            <p className="nota border border-dashed border-gray-20 px-3.5 py-3 text-gray-45">
              Todavía no entró ninguna transferencia de esta familia.
            </p>
          ) : (
            <div className="border border-gray-20">
              {datos.pagos.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-gray-20 px-3.5 py-2.5 last:border-b-0"
                >
                  <span className="font-mono text-[12.5px]">
                    {pesos(p.monto)}
                  </span>
                  <span className="font-rotulo text-[11.5px] uppercase tracking-[0.05em] text-gray-45">
                    {fechaHora(p.recibidoEn)}
                  </span>
                  {/* Es el identificador con el que se cruza contra Talo si
                      alguna vez hay que discutir un pago. */}
                  <span className="w-full font-mono text-[10.5px] text-gray-45 break-all">
                    {p.taloTransactionId}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Seccion>

        <Seccion titulo="Enlaces">
          <div className="grid gap-2">
            <Enlace
              titulo="Acceso al panel"
              nota="Es el que se le manda a la familia: entra a su panel."
              valor={datos.linkRegistro}
            />
            <Enlace
              titulo="Pago directo"
              nota="Abre la cuota sin cuenta ni registro."
              valor={datos.linkPago}
            />
          </div>
        </Seccion>

        <Seccion titulo="Avisos por email">
          <Campo
            label="Email de la familia"
            type="email"
            placeholder={datos.emailContacto ?? "mama@mail.com"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            hint={
              datos.emailContacto
                ? `Guardado: ${datos.emailContacto} — escribí otro para reemplazarlo`
                : "Este alumno todavía no tiene contacto cargado"
            }
          />

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Boton
              variante="fantasma"
              onClick={() => invitar.mutate({ alumnoId: datos.id, email })}
              disabled={ocupado || (!email && !datos.emailContacto)}
            >
              <IconoSobre />
              Invitar
            </Boton>

            <Ayuda
              texto={
                datos.plan.deuda === 0
                  ? "No debe nada"
                  : `Debe ${pesos(datos.plan.deuda)}`
              }
              lado="arriba"
            >
              <Boton
                variante="fantasma"
                className="w-full"
                onClick={() => recordar.mutate({ alumnoId: datos.id })}
                disabled={ocupado || datos.plan.deuda === 0}
              >
                <IconoCampana />
                Recordar
              </Boton>
            </Ayuda>
          </div>
        </Seccion>

        {modoDemo && datos.plan.deuda > 0 && (
          <Seccion titulo="Demo">
            <Boton
              variante="fantasma"
              className="w-full"
              onClick={() => simular.mutate({ alumnoId: datos.id })}
              disabled={ocupado}
            >
              <IconoProbeta />
              Simular transferencia (test)
            </Boton>
            <p className="nota mt-2 text-[11.5px] text-gray-45">
              Entra por el mismo webhook que va a usar Talo en producción.
            </p>
          </Seccion>
        )}

        {datos.responsables.length > 0 && (
          <Seccion titulo="Responsables">
            <div className="border border-gray-20">
              {datos.responsables.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 border-b border-gray-20 px-3.5 py-2.5 last:border-b-0"
                >
                  <span className="font-mono text-[11.5px] break-all">
                    {r.email}
                  </span>
                  <BotonTexto
                    onClick={confirmar(`tutor:${r.id}`, () =>
                      desvincular.mutate({ tutorId: r.id }),
                    )}
                    disabled={ocupado}
                    className="shrink-0 text-gray-45"
                  >
                    {confirmando === `tutor:${r.id}` ? "¿Seguro?" : "Sacar"}
                  </BotonTexto>
                </div>
              ))}
            </div>
          </Seccion>
        )}

        <Seccion titulo="Sin vuelta atrás">
          <Boton
            variante="fantasma"
            className="w-full border-marca text-marca hover:bg-marca hover:text-paper"
            onClick={confirmar("eliminar", () =>
              eliminar.mutate({ alumnoId: datos.id }),
            )}
            disabled={ocupado}
          >
            <IconoPapelera />
            {confirmando === "eliminar"
              ? `Confirmar — se borra a ${datos.nombre} y sus pagos`
              : `Eliminar a ${datos.nombre}`}
          </Boton>
        </Seccion>
      </div>
    </Modal>
  );
}
