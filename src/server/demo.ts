import "server-only";

import { env } from "~/env";

/**
 * La llave de las herramientas de demostración.
 *
 * El simulador de transferencias, la confirmación de pagos de Mercado Pago y el
 * link de acceso mostrado en pantalla existen para poder recorrer el sistema sin
 * plata real ni casilla de correo. Son, por definición, puertas abiertas: quien
 * las alcanza puede darse por pagado sin transferir y entrar sin verificar su
 * email.
 *
 * Por eso no alcanza con estar en modo "mock": en producción quedan cerradas
 * salvo que alguien las abra a propósito con DEMO_ABIERTA=si. Fuera de
 * producción quedan disponibles, que es donde se muestra el recorrido.
 *
 * Es una sola función a propósito: la regla vive en un lugar, y agregar una
 * herramienta nueva de demo es acordarse de preguntarle a esta.
 */
export function demoAbierta() {
  if (env.NODE_ENV !== "production") return true;
  return env.DEMO_ABIERTA;
}

/** El simulador de transferencias de Talo. Pide además estar en modo mock. */
export function simuladorTaloActivo() {
  return demoAbierta() && env.TALO_MODE !== "real";
}

/** La confirmación de pagos falsos de Mercado Pago. Pide estar en modo mock. */
export function simuladorMpActivo() {
  return demoAbierta() && env.MP_MODE !== "real";
}
