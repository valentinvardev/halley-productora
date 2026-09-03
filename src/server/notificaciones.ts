import type { TipoNotificacion } from "../../generated/prisma";
import { env } from "~/env";
import { contacto } from "./ajustes";
import { fecha, pesos } from "~/lib/format";
import { linkAlumno, linkRegistroAlumno } from "./dominio";
import { db } from "./db";
import { emailHabilitado, enviarEmail } from "./email";
import { plantillaEmail } from "./email-plantilla";
import { render, textosDe } from "./plantillas";

/**
 * Capa de notificaciones. Todo mensaje se registra primero en la tabla
 * `Notificacion` — eso es la bandeja del panel y el historial de lo que se le
 * dijo a cada familia — y recién después, si `EMAIL_MODE=resend`, sale por
 * Resend. Con `EMAIL_MODE=bandeja` (el modo de la demo) no sale nada.
 *
 * El envío nunca tumba la operación que lo disparó: si Resend falla, el pago ya
 * quedó registrado y el error se guarda para verlo en el panel y reintentar.
 */

type Alumno = { id: string; nombre: string; token: string; alias: string };
type Grupo = { id: string; nombre: string; colegio: string; slug: string };

/**
 * La casilla de Halley para los avisos.
 *
 * Sale del panel y no de la variable de entorno, para que puedan cambiarla
 * sin un deploy. La variable queda de respaldo para cuando no la tocaron.
 */
async function casillaDeAvisos() {
  const { mailAvisos } = await contacto();
  return mailAvisos || env.ADMIN_EMAIL;
}

async function entregar(
  data: {
    // El enum de la base y no una copia escrita a mano: la copia se olvida de
    // crecer cuando aparece un tipo nuevo, y el error sale lejos de acá.
    tipo: TipoNotificacion;
    destinatario: string;
    asunto: string;
    cuerpo: string;
    alumnoId?: string;
    grupoId?: string;
  },
  /** La cara HTML. El texto de `cuerpo` queda de fallback y de registro. */
  html?: string,
) {
  const notificacion = await db.notificacion.create({ data });

  if (!emailHabilitado) return notificacion;

  const resultado = await enviarEmail({
    para: data.destinatario,
    asunto: data.asunto,
    texto: data.cuerpo,
    html,
  });

  return db.notificacion.update({
    where: { id: notificacion.id },
    data: resultado.ok
      ? { enviadoEl: new Date(), resendId: resultado.id }
      : { errorEnvio: resultado.error },
  });
}

const firma = ["", "Halley Audiovisual"];

/**
 * El pedido de valoración, con su link.
 *
 * Sale a la familia después del servicio. El link vive en la fila de la
 * valoración y lo arma quien la pidió; acá sólo se manda.
 */
export async function notificarValoracion({
  alumno,
  grupo,
  email,
  link,
}: {
  alumno: Alumno;
  grupo: Grupo;
  email: string;
  link: string;
}) {
  const t = await textosDe("valoracion");
  const con = (texto: string) =>
    render(texto, { alumno: alumno.nombre, grupo: grupo.nombre });
  return entregar(
    {
      tipo: "VALORACION",
      destinatario: email,
      asunto: con(t.asunto),
      cuerpo: [
        "Hola,",
        "",
        con(t.parrafo),
        "",
        `Dejá tu valoración acá: ${link}`,
        ...(t.nota ? ["", con(t.nota)] : []),
        ...firma,
      ].join("\n"),
      alumnoId: alumno.id,
      grupoId: grupo.id,
    },
    plantillaEmail({
      preheader: `Contanos cómo la pasaron en el evento de ${alumno.nombre}.`,
      titulo: con(t.titulo),
      saludo: "Hola,",
      parrafos: [con(t.parrafo)],
      boton: { texto: "Dejar mi valoración", url: link },
      nota: t.nota ? con(t.nota) : undefined,
    }),
  );
}

/** Invitación a registrarse en el grupo. */
export async function notificarInvitacion(
  { alumno, grupo, email }: { alumno: Alumno; grupo: Grupo; email: string },
  cuota: { numero: number; total: number; monto: number; venceEl: Date } | null,
) {
  const registro = linkRegistroAlumno(grupo.slug, alumno.id);

  const t = await textosDe("invitacion");
  // Sin cuota cargada las variables del plan quedan en blanco en vez de dejar
  // el `{monto}` crudo en el mail. El texto de fábrica no las usa, pero nada
  // impide que alguien las agregue desde el panel.
  const vars = {
    alumno: alumno.nombre,
    grupo: grupo.nombre,
    cuota: cuota ? String(cuota.numero) : "",
    total: cuota ? String(cuota.total) : "",
    monto: cuota ? pesos(cuota.monto) : "",
    vence: cuota ? fecha(cuota.venceEl) : "",
  };
  const con = (texto: string) => render(texto, vars);

  return entregar(
    {
      tipo: "INVITACION",
      destinatario: email,
      asunto: con(t.asunto),
      cuerpo: [
        "Hola,",
        "",
        con(t.parrafo),
        ...(cuota
          ? [
              "",
              `Próxima cuota: ${cuota.numero} de ${cuota.total} — ${pesos(cuota.monto)}`,
              `Vence: ${fecha(cuota.venceEl)}`,
            ]
          : []),
        "",
        `Creá tu cuenta acá: ${registro}`,
        ...(t.nota ? ["", con(t.nota)] : []),
        "",
        `Si preferís no registrarte, este link te lleva directo al pago: ${linkAlumno(alumno.token)}`,
        ...firma,
      ].join("\n"),
      alumnoId: alumno.id,
      grupoId: grupo.id,
    },
    plantillaEmail({
      preheader: `Seguí los pagos de ${alumno.nombre} y accedé a la galería.`,
      titulo: con(t.titulo),
      saludo: "Hola,",
      parrafos: [con(t.parrafo)],
      destacado: cuota
        ? {
            rotulo: `Próxima cuota — ${cuota.numero} de ${cuota.total}`,
            valor: pesos(cuota.monto),
            pie: `Vence el ${fecha(cuota.venceEl)}`,
          }
        : undefined,
      boton: { texto: "Crear mi cuenta", url: registro },
      nota: `${con(t.nota)} Si preferís no registrarte, este link te lleva directo al pago: ${linkAlumno(alumno.token)}`.trim(),
    }),
  );
}

/** Magic link: entrar o registrarse. */
export async function notificarAcceso(
  email: string,
  url: string,
  minutos: number,
) {
  const t = await textosDe("acceso");

  return entregar(
    {
      tipo: "ACCESO",
      destinatario: email,
      asunto: t.asunto,
      cuerpo: [
        "Hola,",
        "",
        t.parrafo,
        "",
        url,
        "",
        `Vence en ${minutos} minutos y sirve una sola vez.`,
        ...(t.nota ? ["", t.nota] : []),
        ...firma,
      ].join("\n"),
    },
    plantillaEmail({
      preheader:
        "Tu link de acceso a Halley. Vence en un rato y sirve una vez.",
      titulo: t.titulo,
      saludo: "Hola,",
      parrafos: [t.parrafo],
      boton: { texto: "Entrar", url },
      // Los minutos los pone el sistema y no el texto: si el día de mañana el
      // enlace dura otra cosa, un texto editado a mano diría treinta para
      // siempre.
      nota: `El link vence en ${minutos} minutos y sirve una sola vez. ${t.nota}`.trim(),
    }),
  );
}

export async function notificarPagoRecibido(
  { alumno, grupo, emails }: { alumno: Alumno; grupo: Grupo; emails: string[] },
  pago: { monto: number; cuota: number; deuda: number },
) {
  const t = await textosDe("pagoRecibido");
  const vars = {
    alumno: alumno.nombre,
    grupo: grupo.nombre,
    cuota: String(pago.cuota),
    monto: pesos(pago.monto),
  };
  const con = (texto: string) => render(texto, vars);

  for (const email of emails) {
    await entregar(
      {
        tipo: "CONFIRMACION_PADRE",
        destinatario: email,
        asunto: con(t.asunto),
        cuerpo: [
          "Hola,",
          "",
          con(t.parrafo),
          "",
          pago.deuda > 0
            ? `Saldo pendiente del plan: ${pesos(pago.deuda)}.`
            : "Con esto quedás al día con todo el plan.",
          ...(t.nota ? ["", con(t.nota)] : []),
          ...firma,
        ].join("\n"),
        alumnoId: alumno.id,
        grupoId: grupo.id,
      },
      plantillaEmail({
        preheader: `Acreditamos ${pesos(pago.monto)} de la cuota ${pago.cuota} de ${alumno.nombre}.`,
        titulo: con(t.titulo),
        saludo: "Hola,",
        parrafos: [con(t.parrafo)],
        destacado: {
          rotulo: "Pago acreditado",
          valor: pesos(pago.monto),
          pie:
            pago.deuda > 0
              ? `Saldo pendiente del plan: ${pesos(pago.deuda)}`
              : "Con esto quedás al día con todo el plan.",
        },
        boton: { texto: "Ver el estado", url: linkAlumno(alumno.token) },
      }),
    );
  }

  return entregar(
    {
      tipo: "AVISO_ADMIN",
      destinatario: await casillaDeAvisos(),
      asunto: `Pago recibido — ${alumno.nombre} (${grupo.colegio})`,
      cuerpo: [
        `Se acreditaron ${pesos(pago.monto)} de ${alumno.nombre}, cuota ${pago.cuota}.`,
        "",
        `Grupo: ${grupo.nombre}`,
        `Alias: ${alumno.alias}`,
        pago.deuda > 0
          ? `Saldo del plan: ${pesos(pago.deuda)}`
          : "Plan completo.",
      ].join("\n"),
      alumnoId: alumno.id,
      grupoId: grupo.id,
    },
    plantillaEmail({
      preheader: `${pesos(pago.monto)} de ${alumno.nombre} — ${grupo.colegio}.`,
      titulo: "Pago recibido",
      parrafos: [
        `Se acreditó un pago de ${alumno.nombre}, cuota ${pago.cuota}.`,
        `Grupo: ${grupo.nombre} · Alias: ${alumno.alias}`,
      ],
      destacado: {
        rotulo: "Acreditado",
        valor: pesos(pago.monto),
        pie:
          pago.deuda > 0
            ? `Saldo del plan: ${pesos(pago.deuda)}`
            : "Plan completo",
      },
    }),
  );
}

/**
 * La transferencia entró pero no alcanzó a completar la cuota.
 *
 * Es el hueco que dejaba el comprobante: sólo sale cuando una cuota se salda,
 * así que la familia que manda de menos —porque transfirió el monto pelado sin
 * el recargo, o porque redondeó para abajo— no recibía nada. Justo en el
 * momento en que algo salió mal, el sistema se quedaba callado y se enteraban
 * recién si entraban al panel por su cuenta.
 *
 * Dice lo que entró, lo que falta y de qué cuota, que es lo único que hace
 * falta para arreglarlo. El monto que falta sale del plan ya imputado, así que
 * lleva el recargo del día adentro: es lo que hay que transferir hoy, no lo que
 * se debía cuando venció.
 *
 * No existe el aviso espejo —el de la transferencia que se pasa y deja saldo a
 * favor— a propósito: ese caso no le pide nada a nadie.
 */
export async function notificarPagoParcial(
  { alumno, grupo, emails }: { alumno: Alumno; grupo: Grupo; emails: string[] },
  pago: { monto: number; cuota: number; falta: number },
) {
  const t = await textosDe("pagoParcial");
  const vars = {
    alumno: alumno.nombre,
    grupo: grupo.nombre,
    cuota: String(pago.cuota),
    monto: pesos(pago.monto),
    falta: pesos(pago.falta),
  };
  const con = (texto: string) => render(texto, vars);

  for (const email of emails) {
    await entregar(
      {
        tipo: "PAGO_PARCIAL",
        destinatario: email,
        asunto: con(t.asunto),
        cuerpo: [
          "Hola,",
          "",
          con(t.parrafo),
          "",
          `Podés transferir la diferencia acá: ${linkAlumno(alumno.token)}`,
          ...(t.nota ? ["", con(t.nota)] : []),
          ...firma,
        ].join("\n"),
        alumnoId: alumno.id,
        grupoId: grupo.id,
      },
      plantillaEmail({
        preheader: `Faltaron ${pesos(pago.falta)} para completar la cuota ${pago.cuota} de ${alumno.nombre}.`,
        titulo: con(t.titulo),
        saludo: "Hola,",
        parrafos: [con(t.parrafo)],
        destacado: {
          rotulo: `Falta de la cuota ${pago.cuota}`,
          valor: pesos(pago.falta),
          pie: "Es lo que hay que transferir para cerrarla",
          alerta: true,
        },
        boton: {
          texto: "Pagar la diferencia",
          url: linkAlumno(alumno.token),
        },
        nota: con(t.nota) || undefined,
      }),
    );
  }

  // Halley también se entera. Un pago que no cerró la cuota es de las pocas
  // cosas del circuito que necesitan que alguien haga algo después.
  return entregar(
    {
      tipo: "AVISO_ADMIN",
      destinatario: await casillaDeAvisos(),
      asunto: `Pago incompleto — ${alumno.nombre} (${grupo.colegio})`,
      cuerpo: [
        `${alumno.nombre} transfirió ${pesos(pago.monto)} para la cuota ${pago.cuota}, y faltaron ${pesos(pago.falta)}.`,
        "",
        `Grupo: ${grupo.nombre}`,
        `Alias: ${alumno.alias}`,
      ].join("\n"),
      alumnoId: alumno.id,
      grupoId: grupo.id,
    },
    plantillaEmail({
      preheader: `${alumno.nombre} quedó a ${pesos(pago.falta)} de cerrar la cuota ${pago.cuota}.`,
      titulo: "Pago incompleto",
      parrafos: [
        `${alumno.nombre} transfirió ${pesos(pago.monto)} para la cuota ${pago.cuota} y no alcanzó a cubrirla.`,
        `Grupo: ${grupo.nombre} · Alias: ${alumno.alias}`,
      ],
      destacado: {
        rotulo: "Falta",
        valor: pesos(pago.falta),
        pie: `De la cuota ${pago.cuota}`,
        alerta: true,
      },
    }),
  );
}

export async function notificarRecordatorio(
  { alumno, grupo, email }: { alumno: Alumno; grupo: Grupo; email: string },
  cuota: { numero: number; monto: number; venceEl: Date; vencida: boolean },
) {
  // Vencida y por vencer son dos plantillas y no una con un `if` adentro: son
  // dos mensajes distintos —uno avisa, el otro reclama— y Halley tiene que
  // poder darles tono distinto sin tocar el otro.
  const t = await textosDe(
    cuota.vencida ? "recordatorioVencida" : "recordatorio",
  );
  const vars = {
    alumno: alumno.nombre,
    grupo: grupo.nombre,
    cuota: String(cuota.numero),
    monto: pesos(cuota.monto),
    vence: fecha(cuota.venceEl),
  };
  const con = (texto: string) => render(texto, vars);

  return entregar(
    {
      tipo: "RECORDATORIO",
      destinatario: email,
      asunto: con(t.asunto),
      cuerpo: [
        "Hola,",
        "",
        con(t.parrafo),
        "",
        `Pagala acá: ${linkAlumno(alumno.token)}`,
        ...(t.nota ? ["", con(t.nota)] : []),
        ...firma,
      ].join("\n"),
      alumnoId: alumno.id,
      grupoId: grupo.id,
    },
    plantillaEmail({
      preheader: cuota.vencida
        ? `La cuota ${cuota.numero} de ${alumno.nombre} está vencida.`
        : `Se acerca el vencimiento de la cuota ${cuota.numero} de ${alumno.nombre}.`,
      titulo: con(t.titulo),
      saludo: "Hola,",
      parrafos: [con(t.parrafo)],
      destacado: {
        rotulo: `Cuota ${cuota.numero}`,
        valor: pesos(cuota.monto),
        pie: `${cuota.vencida ? "Venció el" : "Vence el"} ${fecha(cuota.venceEl)}`,
        alerta: cuota.vencida,
      },
      boton: { texto: "Pagar la cuota", url: linkAlumno(alumno.token) },
      nota: con(t.nota) || undefined,
    }),
  );
}

/**
 * La copia del presupuesto armado en el simulador.
 *
 * Va a alguien que todavía no es cliente: no hay alumno ni grupo del que
 * colgarla, así que es la única notificación que queda suelta en la bandeja. Se
 * manda sólo si lo pidió — el toggle del paso de contacto — y lo que lleva es el
 * código y el link, no el detalle completo: el detalle está del otro lado del
 * link, donde además se puede reeditar.
 */
export async function notificarPresupuesto({
  email,
  nombre,
  evento,
  codigo,
  total,
  reserva,
  url,
}: {
  email: string;
  nombre: string;
  /** Cómo se lo nombra: "tu boda", "tu quince". */
  evento: string;
  codigo: string;
  total: number;
  reserva: number;
  url: string;
}) {
  const primerNombre = nombre.trim().split(/\s+/)[0] ?? "";

  return entregar(
    {
      tipo: "PRESUPUESTO",
      destinatario: email,
      asunto: `Tu presupuesto — ${codigo}`,
      cuerpo: [
        `Hola${primerNombre ? ` ${primerNombre}` : ""},`,
        "",
        `Este es el presupuesto que armaste para ${evento}.`,
        "",
        `Código: ${codigo}`,
        `Total: ${pesos(total)}`,
        `Reserva para congelar el precio: ${pesos(reserva)}`,
        "",
        `Verlo o modificarlo: ${url}`,
        "",
        "El presupuesto queda guardado con ese código. Los valores se congelan al abonar la reserva.",
        ...firma,
      ].join("\n"),
    },
    plantillaEmail({
      preheader: `Tu presupuesto para ${evento}, con el código ${codigo}.`,
      titulo: "Tu presupuesto",
      saludo: `Hola${primerNombre ? ` ${primerNombre}` : ""},`,
      parrafos: [
        `Este es el presupuesto que armaste para ${evento}. Queda guardado con el código ${codigo}: con él lo podés volver a abrir, modificarlo o pasárnoslo por WhatsApp.`,
      ],
      destacado: {
        rotulo: "Total",
        valor: pesos(total),
        pie: `Reserva para congelar el precio: ${pesos(reserva)}`,
      },
      boton: { texto: "Ver mi presupuesto", url },
      nota: "Los valores quedan congelados al abonar la reserva. Si tenés dudas, respondé este correo.",
    }),
  );
}
