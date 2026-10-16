"use client";

import { useRef, useState, type ReactNode } from "react";

import { Ayuda } from "~/app/_components/ayuda";
import { Copiar } from "~/app/_components/copiar";
import {
  IconoCampana,
  IconoCandado,
  IconoEstrella,
  IconoPapelera,
  IconoProbeta,
  IconoSobre,
  IconoTilde,
} from "~/app/_components/iconos";
import { Modal } from "~/app/_components/modal";
import { PlanCuotas } from "~/app/_components/plan-cuotas";
import { PrecioDelAlumno } from "./montos-plan";
import { MoraDelAlumno, type CuotaConMora } from "./mora-alumno";
import {
  Boton,
  BotonTexto,
  Campo,
  Dato,
  Tag,
  TiraDatos,
} from "~/app/_components/ui";
import { fecha, fechaHora, pesos } from "~/lib/format";
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
  responsables: {
    id: string;
    email: string;
    /** Si está, esta cuenta entra escribiendo el email, sin link. */
    sinEnlace: { desde: Date; usos: number; ultimoUsoEl: Date | null } | null;
  }[];
  plan: {
    total: number;
    pagado: number;
    deuda: number;
    aFavor: number;
    cuotas: CuotaConMora[];
    proxima: { id: string } | null;
  };
  pagos: {
    id: string;
    monto: number;
    recibidoEn: Date;
    refPago: string;
  }[];
  /**
   * Lo que esta familia tiene distinto por cuota: precio o fecha propios, y
   * la mora perdonada.
   */
  ajustes: {
    cuotaId: string;
    monto: number | null;
    venceEl: Date | null;
    sinMora: boolean;
  }[];
};

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
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
  alMarcarCuotas,
}: {
  /** `null` cierra el modal: es el alumno que se está gestionando. */
  alumno: AlumnoAcciones | null;
  modoDemo: boolean;
  alCerrar: () => void;
  alRefrescar: (mensaje?: string) => Promise<void>;
  /** Abre la gestión de cuotas apuntando sólo a este alumno. */
  alMarcarCuotas: () => void;
}) {
  const [email, setEmail] = useState("");
  /** El email que se escribe a mano en Entrar sin link, cuando no es ninguno de la familia. */
  const [otroEmail, setOtroEmail] = useState("");
  const [mostrarOtro, setMostrarOtro] = useState(false);
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
      setOtroEmail("");
      setMostrarOtro(false);
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

  const pedirValoracion = api.valoracion.pedir.useMutation({
    onSuccess: async (r) =>
      avisar(
        r.enviados > 0
          ? `Pedido enviado a ${r.enviados} ${r.enviados === 1 ? "dirección" : "direcciones"}`
          : "No hay a quién escribirle — cargá un email",
      ),
    onError: (e) => setMensaje(e.message),
  });

  const recordar = api.alumno.recordar.useMutation({
    onSuccess: (r) =>
      avisar(
        r.enviado
          ? "Recordatorio enviado"
          : "motivo" in r && r.motivo === "sin-invitar"
            ? "Esta familia todavía no fue invitada — invitala primero"
            : "No hay nada que recordar",
      ),
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
    // Sacar también puede apagar la puerta sin link: si a la cuenta no le
    // queda ningún alumno, el servidor borra la excepción, y acá se dice.
    onSuccess: (r) =>
      avisar(
        r.sinEnlaceQuitado
          ? "Responsable desvinculado. Como no le quedaba ningún alumno, también dejó de entrar sin link."
          : "Responsable desvinculado",
      ),
  });

  // Entrar sin link. El mensaje repite el email entero porque es lo único
  // que la familia tiene que escribir, y si se habilitó uno mal tipeado es
  // acá donde se nota.
  const habilitar = api.accesoSinEnlace.habilitar.useMutation({
    onSuccess: (r) => {
      setOtroEmail("");
      setMostrarOtro(false);
      const nombre = datos?.nombre ?? "";
      // "ya entraba por X" sólo si hay un X que nombrar: una cuenta que quedó
      // habilitada y sin alumnos (eliminar un grupo) no tiene otros.
      const porOtros =
        r.otrosAlumnos.length > 0 ? ` por ${r.otrosAlumnos.join(" y ")}` : "";
      return avisar(
        r.yaEntraba
          ? r.vinculadoNuevo
            ? `${r.email} ya entraba sin link${porOtros}; ahora también ve a ${nombre}.`
            : `${r.email} ya entraba sin link.`
          : `Listo: ${r.email} entra escribiendo su email en Entrar. Mandale el mensaje de abajo.`,
      );
    },
    // El campo de "Otro email" no está en un <form>, así que el navegador no
    // valida nada y un "mama" sin arroba llega al router. Lo que zod devuelve
    // es un JSON en inglés; acá se traduce a lo único que hay que saber.
    onError: (e) =>
      setMensaje(
        e.data?.zodError
          ? "Escribí un email válido, con arroba y dominio."
          : e.message,
      ),
  });

  const quitarSinEnlace = api.accesoSinEnlace.quitar.useMutation({
    onSuccess: (r, v) =>
      avisar(
        r.sesionesCerradas === 0
          ? `${v.email} vuelve a entrar por correo. No había sesiones abiertas sin link.`
          : r.sesionesCerradas === 1
            ? `${v.email} vuelve a entrar por correo. Se cerró 1 sesión abierta sin link.`
            : `${v.email} vuelve a entrar por correo. Se cerraron ${r.sesionesCerradas} sesiones abiertas sin link.`,
      ),
    onError: (e) => setMensaje(e.message),
  });

  const eliminar = api.alumno.eliminar.useMutation({
    onSuccess: async () => {
      cerrar();
      await alRefrescar("Alumno eliminado");
    },
  });

  const ocupado =
    invitar.isPending ||
    pedirValoracion.isPending ||
    recordar.isPending ||
    simular.isPending ||
    desvincular.isPending ||
    habilitar.isPending ||
    quitarSinEnlace.isPending ||
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

  // Los emails de esta familia, para habilitarlos con un clic: los
  // responsables registrados y, si no es uno de ellos, el contacto que cargó
  // el admin. El servidor guarda los emails normalizados, por eso la
  // comparación ignora mayúsculas y espacios.
  const contacto = datos.emailContacto?.trim().toLowerCase() ?? null;
  const candidatos: {
    email: string;
    sinEnlace: AlumnoAcciones["responsables"][number]["sinEnlace"];
  }[] = [
    ...datos.responsables.map((r) => ({
      email: r.email,
      sinEnlace: r.sinEnlace,
    })),
    ...(datos.emailContacto &&
    !datos.responsables.some((r) => r.email.toLowerCase() === contacto)
      ? [{ email: datos.emailContacto, sinEnlace: null }]
      : []),
  ];
  const habilitados = candidatos.filter((c) => c.sinEnlace !== null);
  // Sin ningún email de dónde elegir, el campo arranca abierto.
  const otroAbierto = mostrarOtro || candidatos.length === 0;
  // El origen sale del link de registro, que ya es absoluto.
  const urlEntrar = `${new URL(datos.linkRegistro).origin}/entrar`;

  /** Lo que el rastro de uso dice de una puerta abierta. */
  const rastro = (s: NonNullable<(typeof candidatos)[number]["sinEnlace"]>) =>
    `desde el ${fecha(s.desde)} · ` +
    (s.usos === 0 || !s.ultimoUsoEl
      ? "todavía no entró"
      : `entró ${s.usos} ${s.usos === 1 ? "vez" : "veces"}, la última el ${fechaHora(s.ultimoUsoEl)}`);

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

          {/* La puerta a marcar cuotas de este alumno. Va acá, debajo del
              plan, porque se decide mirándolo: qué cuota está impaga y
              cuánto lleva de recargo. La misma pantalla del grupo, con este
              alumno ya tildado. */}
          {datos.plan.deuda > 0 && (
            <div className="mt-4">
              <Boton variante="fantasma" onClick={alMarcarCuotas}>
                <IconoTilde />
                Marcar cuotas pagadas
              </Boton>
              <p className="nota mt-1.5 text-[11.5px]">
                Para lo que se cobró por fuera del sistema. Ahí se elige si se
                le cobra la mora o no.
              </p>
            </div>
          )}
        </Seccion>

        {/* Va pegada al plan y antes del precio porque se decide mirando el
            plan: qué cuota venció y cuánto le va a sumar. Es el lugar donde
            Halley buscaba "perdonarle la mora" y no lo encontraba. */}
        <Seccion titulo="Mora">
          <MoraDelAlumno
            alumnoId={datos.id}
            cuotas={datos.plan.cuotas}
            ajustes={datos.ajustes}
            alRefrescar={alRefrescar}
          />
        </Seccion>

        <Seccion titulo="Precio de esta familia">
          <PrecioDelAlumno
            alumnoId={datos.id}
            cuotas={datos.plan.cuotas}
            ajustes={datos.ajustes}
            alRefrescar={alRefrescar}
          />
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
                  {/* Es el identificador con el que se cruza contra el
                      proveedor (Talo o Mercado Pago) si alguna vez hay que
                      discutir un pago. */}
                  <span className="w-full font-mono text-[10.5px] text-gray-45 break-all">
                    {p.refPago}
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

        {/* La excepción para la familia que no logra canjear el link. Va acá,
            entre los avisos y lo de después, porque es a esta zona a la que
            se viene cuando el problema es "no puede entrar". Es una puerta
            abierta a propósito, y por eso cada botón lo dice con el email y
            el nombre antes de hacerlo. */}
        <Seccion titulo="Entrar sin link">
          <p className="nota mb-3">
            Para la familia que no logra abrir el link del correo. Con esto,
            escribe su email en Entrar y pasa directo, sin correo. Cualquiera
            que sepa ese email entra al panel de {datos.nombre}.
          </p>

          {candidatos.length > 0 && (
            <div className="border border-gray-20">
              {candidatos.map((c) => (
                <div
                  key={c.email}
                  className="flex items-center justify-between gap-3 border-b border-gray-20 px-3.5 py-2.5 last:border-b-0"
                >
                  {c.sinEnlace === null ? (
                    <>
                      <span className="font-mono text-[11.5px] break-all">
                        {c.email}
                      </span>
                      <BotonTexto
                        onClick={confirmar(`sinenlace:${c.email}`, () =>
                          habilitar.mutate({
                            alumnoId: datos.id,
                            email: c.email,
                          }),
                        )}
                        disabled={ocupado}
                        className={
                          confirmando === `sinenlace:${c.email}`
                            ? "text-marca"
                            : "shrink-0"
                        }
                      >
                        {confirmando === `sinenlace:${c.email}`
                          ? `¿Seguro? Cualquiera que escriba ${c.email} ve el plan, la deuda, el alias para pagar y las fotos de ${datos.nombre}`
                          : "Dejar entrar sin link"}
                      </BotonTexto>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11.5px] break-all">
                            {c.email}
                          </span>
                          <Tag activo>Entra sin link</Tag>
                        </div>
                        <div className="mt-1 text-[11.5px] text-gray-45">
                          {rastro(c.sinEnlace)}
                        </div>
                      </div>
                      <BotonTexto
                        onClick={confirmar(`quitar:${c.email}`, () =>
                          quitarSinEnlace.mutate({ email: c.email }),
                        )}
                        disabled={ocupado}
                        className="shrink-0 text-gray-45"
                      >
                        {confirmando === `quitar:${c.email}`
                          ? "¿Seguro? Vuelve al correo y se cierran sus sesiones sin link"
                          : "Quitar"}
                      </BotonTexto>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Un email que no es ninguno de los de arriba. Existe porque el
              caso real es exactamente ése: la madre usa un correo que no es
              el contacto cargado. Plegado para que no compita con la lista. */}
          {!otroAbierto ? (
            <div className="mt-3">
              <BotonTexto onClick={() => setMostrarOtro(true)}>
                Otro email…
              </BotonTexto>
            </div>
          ) : (
            <div className={candidatos.length > 0 ? "mt-3" : ""}>
              <Campo
                label="Email"
                type="email"
                placeholder="mama@mail.com"
                value={otroEmail}
                onChange={(e) => setOtroEmail(e.target.value)}
                hint={
                  datos.emailContacto
                    ? `Este email no es el que está guardado para ${datos.nombre} (guardado: ${datos.emailContacto}). Se va a crear la cuenta y va a quedar como responsable.`
                    : `${datos.nombre} todavía no tiene ningún email cargado. Se va a crear la cuenta y va a quedar como responsable.`
                }
              />
              <Boton
                variante="fantasma"
                className="mt-3 w-full"
                onClick={confirmar("sinenlace:otro", () =>
                  habilitar.mutate({ alumnoId: datos.id, email: otroEmail }),
                )}
                disabled={ocupado || !otroEmail}
              >
                <IconoCandado />
                {confirmando === "sinenlace:otro"
                  ? `Confirmar: cualquiera que escriba ${otroEmail} entra al panel de ${datos.nombre}`
                  : "Dejar entrar sin link"}
              </Boton>
            </div>
          )}

          {/* El mensaje que Fran le manda por WhatsApp, con el email entero:
              es lo único que la familia tiene que escribir. Una fila por cada
              email habilitado. */}
          {habilitados.length > 0 && (
            <div className="mt-3 grid gap-2">
              {habilitados.map((c) => {
                const texto = `Para entrar: ${urlEntrar}. Escribí ${c.email} y tocá Entrar. No hace falta abrir ningún correo.`;
                return (
                  <div
                    key={c.email}
                    className="flex items-start justify-between gap-4 border border-gray-20 px-3.5 py-3"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px]">Mensaje para la familia</div>
                      <div className="nota text-[11.5px] text-gray-45">
                        {texto}
                      </div>
                    </div>
                    <Copiar
                      valor={texto}
                      etiqueta="Copiar"
                      className="shrink-0"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Seccion>

        <Seccion titulo="Después del evento">
          <p className="nota mb-3">
            Le manda a la familia un link de una semana y un solo uso para dejar
            unas palabras, estrellas y una foto. Lo que llegue queda esperando
            en Valoraciones hasta que lo publiques.
          </p>
          <Boton
            variante="fantasma"
            className="w-full"
            onClick={() => pedirValoracion.mutate({ alumnoId: datos.id })}
            disabled={ocupado}
          >
            <IconoEstrella />
            Pedir valoración
          </Boton>
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
