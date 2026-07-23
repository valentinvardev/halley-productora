import { env } from "~/env";
import { fecha, pesos } from "~/lib/format";
import { linkAlumno, linkRegistroAlumno } from "./dominio";
import { db } from "./db";
import { emailHabilitado, enviarEmail } from "./email";
import { plantillaEmail } from "./email-plantilla";

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

async function entregar(
  data: {
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

/** Invitación a registrarse en el grupo. */
export async function notificarInvitacion(
  { alumno, grupo, email }: { alumno: Alumno; grupo: Grupo; email: string },
  cuota: { numero: number; total: number; monto: number; venceEl: Date } | null,
) {
  const registro = linkRegistroAlumno(grupo.slug, alumno.id);

  return entregar(
    {
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
        `Creá tu cuenta para seguir los pagos de ${alumno.nombre} y ver la galería:`,
        registro,
        "",
        "No hace falta contraseña: te mandamos un link para entrar.",
        "",
        `Si preferís no registrarte, este link te lleva directo al pago: ${linkAlumno(alumno.token)}`,
        ...firma,
      ].join("\n"),
      alumnoId: alumno.id,
      grupoId: grupo.id,
    },
    plantillaEmail({
      preheader: `Seguí los pagos de ${alumno.nombre} y accedé a la galería.`,
      titulo: `Pagos de ${grupo.nombre}`,
      saludo: "Hola,",
      parrafos: [
        `Ya está abierto el sistema de pagos de ${grupo.nombre}. Creá tu cuenta para seguir la cuota de ${alumno.nombre} de principio a fin y acceder a la galería cuando esté lista.`,
      ],
      destacado: cuota
        ? {
            rotulo: `Próxima cuota — ${cuota.numero} de ${cuota.total}`,
            valor: pesos(cuota.monto),
            pie: `Vence el ${fecha(cuota.venceEl)}`,
          }
        : undefined,
      boton: { texto: "Crear mi cuenta", url: registro },
      nota: `No hace falta contraseña: entrás con tu email. Si preferís no registrarte, este link te lleva directo al pago: ${linkAlumno(alumno.token)}`,
      responder: true,
    }),
  );
}

/** Magic link: entrar o registrarse. */
export async function notificarAcceso(
  email: string,
  url: string,
  minutos: number,
) {
  return entregar(
    {
      tipo: "ACCESO",
      destinatario: email,
      asunto: "Tu link para entrar — Halley Audiovisual",
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
    },
    plantillaEmail({
      preheader: "Tu link de acceso a Halley. Vence en un rato y sirve una vez.",
      titulo: "Tu acceso a Halley",
      saludo: "Hola,",
      parrafos: ["Tocá el botón para entrar a tu panel."],
      boton: { texto: "Entrar", url },
      nota: `El link vence en ${minutos} minutos y sirve una sola vez. Si no lo pediste vos, ignorá este mensaje.`,
    }),
  );
}

export async function notificarPagoRecibido(
  {
    alumno,
    grupo,
    emails,
  }: { alumno: Alumno; grupo: Grupo; emails: string[] },
  pago: { monto: number; cuota: number; deuda: number },
) {
  for (const email of emails) {
    await entregar(
      {
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
      },
      plantillaEmail({
        preheader: `Acreditamos ${pesos(pago.monto)} de la cuota ${pago.cuota} de ${alumno.nombre}.`,
        titulo: "Recibimos tu pago",
        saludo: "Hola,",
        parrafos: [
          `Confirmamos la acreditación del pago de la cuota ${pago.cuota} de ${alumno.nombre}. Este mail es tu comprobante.`,
        ],
        destacado: {
          rotulo: "Pago acreditado",
          valor: pesos(pago.monto),
          pie:
            pago.deuda > 0
              ? `Saldo pendiente del plan: ${pesos(pago.deuda)}`
              : "Con esto quedás al día con todo el plan.",
        },
        boton: { texto: "Ver el estado", url: linkAlumno(alumno.token) },
        responder: true,
      }),
    );
  }

  return entregar(
    {
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
        pie: pago.deuda > 0 ? `Saldo del plan: ${pesos(pago.deuda)}` : "Plan completo",
      },
    }),
  );
}

export async function notificarRecordatorio(
  { alumno, grupo, email }: { alumno: Alumno; grupo: Grupo; email: string },
  cuota: { numero: number; monto: number; venceEl: Date; vencida: boolean },
) {
  return entregar(
    {
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
    },
    plantillaEmail({
      preheader: cuota.vencida
        ? `La cuota ${cuota.numero} de ${alumno.nombre} está vencida.`
        : `Se acerca el vencimiento de la cuota ${cuota.numero} de ${alumno.nombre}.`,
      titulo: cuota.vencida ? "Cuota vencida" : "Recordatorio de cuota",
      saludo: "Hola,",
      parrafos: [
        cuota.vencida
          ? `La cuota ${cuota.numero} de ${alumno.nombre} venció y figura impaga. Si se atrasa más, se le suma un recargo por mora.`
          : `Queda pendiente la cuota ${cuota.numero} de ${alumno.nombre}. Pagando antes del vencimiento evitás recargos.`,
      ],
      destacado: {
        rotulo: `Cuota ${cuota.numero}`,
        valor: pesos(cuota.monto),
        pie: `${cuota.vencida ? "Venció el" : "Vence el"} ${fecha(cuota.venceEl)}`,
        alerta: cuota.vencida,
      },
      boton: { texto: "Pagar la cuota", url: linkAlumno(alumno.token) },
      nota: "Si ya transferiste, ignorá este mensaje.",
      responder: true,
    }),
  );
}
