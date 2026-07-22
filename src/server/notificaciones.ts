import { env } from "~/env";
import { fecha, pesos } from "~/lib/format";
import { linkAlumno, linkGrupo } from "./dominio";
import { db } from "./db";
import { emailHabilitado, enviarEmail } from "./email";

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

async function entregar(data: {
  tipo:
    | "INVITACION"
    | "ACCESO"
    | "CONFIRMACION_PADRE"
    | "AVISO_ADMIN"
    | "RECORDATORIO";
  destinatario: string;
  asunto: string;
  cuerpo: string;
  alumnoId?: string;
  grupoId?: string;
}) {
  const notificacion = await db.notificacion.create({ data });

  if (!emailHabilitado) return notificacion;

  const resultado = await enviarEmail({
    para: data.destinatario,
    asunto: data.asunto,
    texto: data.cuerpo,
  });

  return db.notificacion.update({
    where: { id: notificacion.id },
    data: resultado.ok
      ? { enviadoEl: new Date(), resendId: resultado.id }
      : { errorEnvio: resultado.error },
  });
}

const firma = ["", "Halley Producciones"];

/** Invitación a registrarse en el grupo. */
export async function notificarInvitacion(
  { alumno, grupo, email }: { alumno: Alumno; grupo: Grupo; email: string },
  cuota: { numero: number; total: number; monto: number; venceEl: Date } | null,
) {
  return entregar({
    tipo: "INVITACION",
    destinatario: email,
    asunto: `Pagos de ${grupo.nombre}`,
    cuerpo: [
      "Hola,",
      "",
      `Ya está abierto el sistema de pagos de ${grupo.nombre}.`,
      ...(cuota
        ? [
            "",
            `Próxima cuota: ${cuota.numero} de ${cuota.total} — ${pesos(cuota.monto)}`,
            `Vence: ${fecha(cuota.venceEl)}`,
          ]
        : []),
      "",
      `Entrá con tu email y elegí a ${alumno.nombre} de la lista:`,
      linkGrupo(grupo.slug),
      "",
      "No hace falta contraseña: te mandamos un link para entrar.",
      "",
      `Si preferís no registrarte, este link te lleva directo al pago: ${linkAlumno(alumno.token)}`,
      ...firma,
    ].join("\n"),
    alumnoId: alumno.id,
    grupoId: grupo.id,
  });
}

/** Magic link: entrar o registrarse. */
export async function notificarAcceso(
  email: string,
  url: string,
  minutos: number,
) {
  return entregar({
    tipo: "ACCESO",
    destinatario: email,
    asunto: "Tu link para entrar — Halley Producciones",
    cuerpo: [
      "Hola,",
      "",
      "Entrá con este link:",
      url,
      "",
      `Vence en ${minutos} minutos y sirve una sola vez.`,
      "",
      "Si no lo pediste vos, ignorá este mensaje.",
      ...firma,
    ].join("\n"),
  });
}

export async function notificarPagoRecibido(
  {
    alumno,
    grupo,
    email,
  }: { alumno: Alumno; grupo: Grupo; email: string | null },
  pago: { monto: number; cuota: number; deuda: number },
) {
  if (email) {
    await entregar({
      tipo: "CONFIRMACION_PADRE",
      destinatario: email,
      asunto: `Recibimos tu pago — ${grupo.nombre}`,
      cuerpo: [
        "Hola,",
        "",
        `Confirmamos la acreditación de ${pesos(pago.monto)} para la cuota ${pago.cuota} de ${alumno.nombre}.`,
        "",
        pago.deuda > 0
          ? `Saldo pendiente del plan: ${pesos(pago.deuda)}.`
          : "Con esto quedás al día con todo el plan.",
        "",
        "Este mail es tu comprobante.",
        ...firma,
      ].join("\n"),
      alumnoId: alumno.id,
      grupoId: grupo.id,
    });
  }

  return entregar({
    tipo: "AVISO_ADMIN",
    destinatario: env.ADMIN_EMAIL,
    asunto: `Pago recibido — ${alumno.nombre} (${grupo.colegio})`,
    cuerpo: [
      `Se acreditaron ${pesos(pago.monto)} de ${alumno.nombre}, cuota ${pago.cuota}.`,
      "",
      `Grupo: ${grupo.nombre}`,
      `Alias: ${alumno.alias}`,
      pago.deuda > 0 ? `Saldo del plan: ${pesos(pago.deuda)}` : "Plan completo.",
    ].join("\n"),
    alumnoId: alumno.id,
    grupoId: grupo.id,
  });
}

export async function notificarRecordatorio(
  { alumno, grupo, email }: { alumno: Alumno; grupo: Grupo; email: string },
  cuota: { numero: number; monto: number; venceEl: Date; vencida: boolean },
) {
  return entregar({
    tipo: "RECORDATORIO",
    destinatario: email,
    asunto: cuota.vencida
      ? `Cuota vencida — ${grupo.nombre}`
      : `Recordatorio de cuota — ${grupo.nombre}`,
    cuerpo: [
      "Hola,",
      "",
      cuota.vencida
        ? `La cuota ${cuota.numero} de ${alumno.nombre}, de ${pesos(cuota.monto)}, venció el ${fecha(cuota.venceEl)} y figura impaga.`
        : `Queda pendiente la cuota ${cuota.numero} de ${alumno.nombre}, de ${pesos(cuota.monto)}, que vence el ${fecha(cuota.venceEl)}.`,
      "",
      `Pagala acá: ${linkAlumno(alumno.token)}`,
      "",
      "Si ya transferiste, ignorá este mensaje.",
      ...firma,
    ].join("\n"),
    alumnoId: alumno.id,
    grupoId: grupo.id,
  });
}
