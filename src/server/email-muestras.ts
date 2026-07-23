import "server-only";

import { env } from "~/env";
import { plantillaEmail } from "./email-plantilla";

/**
 * Muestras de cada plantilla, con datos de ejemplo, para el botón de prueba de
 * la bandeja. Sirven para ver cómo llega cada correo a un inbox real sin tener
 * que provocar el evento (un pago, una invitación) de verdad.
 *
 * El texto y el HTML son los mismos que arma `notificaciones.ts`; acá van con
 * valores inventados y links que apuntan a la home.
 */

export const TIPOS_MUESTRA = [
  { valor: "INVITACION", etiqueta: "Invitación" },
  { valor: "ACCESO", etiqueta: "Link de acceso" },
  { valor: "CONFIRMACION_PADRE", etiqueta: "Confirmación de pago" },
  { valor: "RECORDATORIO", etiqueta: "Recordatorio" },
  { valor: "AVISO_ADMIN", etiqueta: "Aviso a Halley" },
] as const;

export type TipoMuestra = (typeof TIPOS_MUESTRA)[number]["valor"];

const APP = env.NEXT_PUBLIC_APP_URL;
const GRUPO = "Egresados 2027 — Colegio San Martín";
const ALUMNO = "Lucía Bustos";

export function muestraEmail(tipo: TipoMuestra): {
  asunto: string;
  texto: string;
  html: string;
} {
  switch (tipo) {
    case "INVITACION":
      return {
        asunto: `[PRUEBA] Pagos de ${GRUPO}`,
        texto: `Ya está abierto el sistema de pagos de ${GRUPO}. Creá tu cuenta para seguir la cuota de ${ALUMNO}.\n\n${APP}`,
        html: plantillaEmail({
          preheader: `Seguí los pagos de ${ALUMNO} y accedé a la galería.`,
          titulo: `Pagos de ${GRUPO}`,
          saludo: "Hola,",
          parrafos: [
            `Ya está abierto el sistema de pagos de ${GRUPO}. Creá tu cuenta para seguir la cuota de ${ALUMNO} de principio a fin y acceder a la galería cuando esté lista.`,
          ],
          destacado: {
            rotulo: "Próxima cuota — 1 de 6",
            valor: "$ 45.000",
            pie: "Vence el 20/05/2026",
          },
          boton: { texto: "Crear mi cuenta", url: `${APP}/entrar` },
          nota: "No hace falta contraseña: entrás con tu email.",
        }),
      };

    case "ACCESO":
      return {
        asunto: "[PRUEBA] Tu link para entrar — Halley Audiovisual",
        texto: `Entrá con este link: ${APP}/entrar\n\nVence en 30 minutos y sirve una sola vez.`,
        html: plantillaEmail({
          preheader: "Tu link de acceso a Halley. Vence en un rato y sirve una vez.",
          titulo: "Tu acceso a Halley",
          saludo: "Hola,",
          parrafos: ["Tocá el botón para entrar a tu panel."],
          boton: { texto: "Entrar", url: `${APP}/entrar` },
          nota: "El link vence en 30 minutos y sirve una sola vez. Si no lo pediste vos, ignorá este mensaje.",
        }),
      };

    case "CONFIRMACION_PADRE":
      return {
        asunto: `[PRUEBA] Recibimos tu pago — ${GRUPO}`,
        texto: `Confirmamos la acreditación de $ 45.000 para la cuota 1 de ${ALUMNO}. Este mail es tu comprobante.`,
        html: plantillaEmail({
          preheader: `Acreditamos $ 45.000 de la cuota 1 de ${ALUMNO}.`,
          titulo: "Recibimos tu pago",
          saludo: "Hola,",
          parrafos: [
            `Confirmamos la acreditación del pago de la cuota 1 de ${ALUMNO}. Este mail es tu comprobante.`,
          ],
          destacado: {
            rotulo: "Pago acreditado",
            valor: "$ 45.000",
            pie: "Saldo pendiente del plan: $ 225.000",
          },
          boton: { texto: "Ver el estado", url: `${APP}` },
        }),
      };

    case "RECORDATORIO":
      return {
        asunto: `[PRUEBA] Cuota vencida — ${GRUPO}`,
        texto: `La cuota 3 de ${ALUMNO}, de $ 45.000, venció el 20/06/2026 y figura impaga.`,
        html: plantillaEmail({
          preheader: `La cuota 3 de ${ALUMNO} está vencida.`,
          titulo: "Cuota vencida",
          saludo: "Hola,",
          parrafos: [
            `La cuota 3 de ${ALUMNO} venció y figura impaga. Si se atrasa más, se le suma un recargo por mora.`,
          ],
          destacado: {
            rotulo: "Cuota 3",
            valor: "$ 45.000",
            pie: "Venció el 20/06/2026",
            alerta: true,
          },
          boton: { texto: "Pagar la cuota", url: `${APP}` },
          nota: "Si ya transferiste, ignorá este mensaje.",
        }),
      };

    case "AVISO_ADMIN":
      return {
        asunto: `[PRUEBA] Pago recibido — ${ALUMNO}`,
        texto: `Se acreditaron $ 45.000 de ${ALUMNO}, cuota 1.`,
        html: plantillaEmail({
          preheader: `$ 45.000 de ${ALUMNO}.`,
          titulo: "Pago recibido",
          parrafos: [
            `Se acreditó un pago de ${ALUMNO}, cuota 1.`,
            `Grupo: ${GRUPO} · Alias: halley.lucia.bustos`,
          ],
          destacado: {
            rotulo: "Acreditado",
            valor: "$ 45.000",
            pie: "Saldo del plan: $ 225.000",
          },
        }),
      };
  }
}
