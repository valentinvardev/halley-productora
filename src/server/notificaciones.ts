import { env } from "~/env";
import { fecha, pesos } from "~/lib/format";
import { linkPadre } from "./dominio";
import { db } from "./db";

/**
 * Capa de notificaciones. En la demo nada sale a internet: cada email queda
 * registrado en la tabla `Notificacion` y se ve en la bandeja del panel.
 * Para producción se reemplaza `entregar()` por una llamada a Resend — los
 * templates y los puntos de disparo no cambian.
 */

type Destinatarios = {
  padre: { id: string; nombre: string; email: string; token: string; alias: string };
  grupo: { id: string; nombre: string; colegio: string; venceEl: Date; cuotaActual: number; cuotasTotales: number };
};

async function entregar(data: {
  tipo: "INVITACION" | "CONFIRMACION_PADRE" | "AVISO_ADMIN" | "RECORDATORIO";
  destinatario: string;
  asunto: string;
  cuerpo: string;
  padreId?: string;
  grupoId?: string;
}) {
  return db.notificacion.create({ data });
}

export async function notificarInvitacion(
  { padre, grupo }: Destinatarios,
  monto: number,
) {
  return entregar({
    tipo: "INVITACION",
    destinatario: padre.email,
    asunto: `Tu cuota de ${grupo.nombre}`,
    cuerpo: [
      `Hola ${padre.nombre},`,
      "",
      `Ya está disponible el link para pagar la cuota ${grupo.cuotaActual} de ${grupo.cuotasTotales} de ${grupo.nombre}.`,
      "",
      `Monto: ${pesos(monto)}`,
      `Vence: ${fecha(grupo.venceEl)}`,
      `Alias: ${padre.alias}`,
      "",
      `Entrá y pagá desde tu banco o billetera: ${linkPadre(padre.token)}`,
      "",
      "No hace falta crear usuario ni contraseña.",
      "",
      "Halley Producciones",
    ].join("\n"),
    padreId: padre.id,
    grupoId: grupo.id,
  });
}

export async function notificarPagoRecibido(
  { padre, grupo }: Destinatarios,
  monto: number,
) {
  const confirmacion = await entregar({
    tipo: "CONFIRMACION_PADRE",
    destinatario: padre.email,
    asunto: `Recibimos tu pago — ${grupo.nombre}`,
    cuerpo: [
      `Hola ${padre.nombre},`,
      "",
      `Confirmamos la acreditación de ${pesos(monto)} correspondiente a la cuota ${grupo.cuotaActual} de ${grupo.cuotasTotales}.`,
      "",
      "Gracias. Este mail es tu comprobante.",
      "",
      "Halley Producciones",
    ].join("\n"),
    padreId: padre.id,
    grupoId: grupo.id,
  });

  const aviso = await entregar({
    tipo: "AVISO_ADMIN",
    destinatario: env.ADMIN_EMAIL,
    asunto: `Pago recibido — ${padre.nombre} (${grupo.colegio})`,
    cuerpo: [
      `${padre.nombre} pagó ${pesos(monto)}.`,
      "",
      `Grupo: ${grupo.nombre}`,
      `Alias: ${padre.alias}`,
    ].join("\n"),
    padreId: padre.id,
    grupoId: grupo.id,
  });

  return { confirmacion, aviso };
}

export async function notificarRecordatorio(
  { padre, grupo }: Destinatarios,
  monto: number,
) {
  const vencido = grupo.venceEl.getTime() < Date.now();

  return entregar({
    tipo: "RECORDATORIO",
    destinatario: padre.email,
    asunto: vencido
      ? `Cuota vencida — ${grupo.nombre}`
      : `Recordatorio de cuota — ${grupo.nombre}`,
    cuerpo: [
      `Hola ${padre.nombre},`,
      "",
      vencido
        ? `La cuota de ${pesos(monto)} venció el ${fecha(grupo.venceEl)} y todavía figura impaga.`
        : `Te queda pendiente la cuota de ${pesos(monto)}, que vence el ${fecha(grupo.venceEl)}.`,
      "",
      `Podés pagarla acá: ${linkPadre(padre.token)}`,
      "",
      "Si ya transferiste, ignorá este mensaje.",
      "",
      "Halley Producciones",
    ].join("\n"),
    padreId: padre.id,
    grupoId: grupo.id,
  });
}
