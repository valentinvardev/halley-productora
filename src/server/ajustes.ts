import "server-only";

import { db } from "./db";

/**
 * Los ajustes que el admin edita desde el panel.
 *
 * Van en una tabla clave/valor porque son pocos y sueltos: el WhatsApp al que
 * escriben las familias, el Instagram, la casilla de contacto. Cada uno tiene un
 * valor por defecto, así que el sitio funciona aunque nunca se hayan tocado.
 */

export const AJUSTES = {
  whatsapp: {
    etiqueta: "WhatsApp",
    ayuda: "Sólo números, con código de país y área. Ej: 5493513000000",
    porDefecto: "5493513000000",
  },
  instagram: {
    etiqueta: "Instagram",
    ayuda: "La URL completa del perfil.",
    porDefecto: "https://instagram.com/halley.audiovisual",
  },
  mail: {
    etiqueta: "Email de contacto",
    ayuda: "La casilla que se muestra en la web.",
    porDefecto: "hola@halleyaudiovisual.com",
  },
  /**
   * A dónde le llegan a Halley los avisos: pago recibido, pago incompleto.
   *
   * Es otra casilla que la de contacto a propósito. La de contacto es la que
   * se publica en la web y le escribe cualquiera; ésta es a la que quieren
   * que les lleguen las cosas que pasan, y pueden no ser la misma persona.
   *
   * Vacío cae a la variable de entorno, que es donde vivía hasta ahora. Así
   * una instalación que nunca lo tocó sigue avisando a donde avisaba.
   */
  mailAvisos: {
    etiqueta: "Email de avisos",
    ayuda:
      "A dónde llegan los avisos de pagos. Vacío usa la casilla del sistema.",
    porDefecto: "",
  },
  /**
   * Qué suena cuando entra un pago mientras el panel está abierto.
   *
   * Vive acá con el resto porque es lo mismo: un valor suelto que se cambia sin
   * deploy. "silencio" apaga el sonido pero no el aviso en pantalla, que son dos
   * molestias distintas y conviene poder elegirlas por separado.
   */
  sonidoPago: {
    etiqueta: "Sonido al cobrar",
    ayuda: "Suena en el panel cuando entra un pago.",
    porDefecto: "campana",
  },
} as const;

export type ClaveAjuste = keyof typeof AJUSTES;

export type Contacto = Record<ClaveAjuste, string>;

/** Los valores guardados, con el default de cada uno si falta. */
export async function contacto(): Promise<Contacto> {
  const filas = await db.ajuste.findMany({
    where: { clave: { in: Object.keys(AJUSTES) } },
  });
  const guardados = new Map(filas.map((f) => [f.clave, f.valor]));

  const salida = {} as Contacto;
  for (const clave of Object.keys(AJUSTES) as ClaveAjuste[]) {
    const valor = guardados.get(clave)?.trim();
    salida[clave] =
      valor && valor.length > 0 ? valor : AJUSTES[clave].porDefecto;
  }
  return salida;
}

/** El link de WhatsApp con el mensaje ya escrito. */
export function linkWhatsApp(numero: string, mensaje: string) {
  const limpio = numero.replace(/[^\d]/g, "");
  return `https://wa.me/${limpio}?text=${encodeURIComponent(mensaje)}`;
}
