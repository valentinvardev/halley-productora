import "server-only";

import { Resolver } from "node:dns/promises";

import { FRENADO } from "~/app/_datos/correo";

/**
 * Lo que se mira antes de mandar un correo, para no mandarlo al vacío.
 *
 * Un correo a un dominio que no existe vuelve como rebote, y los rebotes son lo
 * que más rápido hunde la reputación de un dominio: Resend pausa la cuenta
 * pasado el 4%. En noviembre de 2026 había nueve familias con el dominio mal
 * escrito ("gmail.con", "hotmail.comn") y todos los avisos a Halley iban a
 * admin@halleyproducciones.com, un dominio que no está registrado: 955 avisos
 * en dos meses que no le llegaron a nadie.
 */

/**
 * Un resolvedor propio con tiempos cortos. El de fábrica reintenta varias veces
 * con cinco segundos cada vez, y un DNS lento no puede frenar el link para
 * entrar de una familia que está esperando con el teléfono en la mano.
 */
const resolvedor = new Resolver({ timeout: 2500, tries: 2 });

/**
 * Lo que ya se averiguó, para no preguntar lo mismo con cada correo: un envío
 * en masa repite gmail.com cuatrocientas veces. Si el DNS no contestó se
 * guarda poco, para volver a preguntar pronto.
 */
const memoria = new Map<string, { recibe: boolean | null; hasta: number }>();
const VIDA = 6 * 60 * 60 * 1000;
const VIDA_SIN_RESPUESTA = 5 * 60 * 1000;

/**
 * Si el dominio puede recibir correo.
 *
 * `null` es "no se pudo saber": el DNS no contestó a tiempo. Ahí el correo
 * sale igual, porque frenar un comprobante por un problema de red de este lado
 * sería peor que el rebote que se quería evitar.
 */
export async function dominioRecibe(dominio: string): Promise<boolean | null> {
  const d = dominio.trim().toLowerCase().replace(/\.$/, "");
  const guardado = memoria.get(d);
  if (guardado && guardado.hasta > Date.now()) return guardado.recibe;

  const recibe = await consultar(d);
  memoria.set(d, {
    recibe,
    hasta: Date.now() + (recibe === null ? VIDA_SIN_RESPUESTA : VIDA),
  });
  return recibe;
}

async function consultar(dominio: string): Promise<boolean | null> {
  try {
    const mx = await resolvedor.resolveMx(dominio);
    // Un único MX vacío es la forma estándar de decir "acá no se recibe
    // correo" (RFC 7505).
    if (mx.length === 1 && (mx[0]?.exchange ?? "") === "") return false;
    if (mx.length > 0) return true;
  } catch (e) {
    if (!noExiste(e)) return null;
  }

  // Sin MX, el correo se entrega a la dirección del dominio mismo (RFC 5321).
  // Es raro, pero un dominio así sí recibe.
  for (const buscar of [
    () => resolvedor.resolve4(dominio),
    () => resolvedor.resolve6(dominio),
  ]) {
    try {
      if ((await buscar()).length > 0) return true;
    } catch (e) {
      if (!noExiste(e)) return null;
    }
  }
  return false;
}

/** El DNS contestó, y lo que contestó es que no hay nada. */
function noExiste(e: unknown) {
  const codigo = (e as { code?: string } | null)?.code;
  return codigo === "ENOTFOUND" || codigo === "ENODATA";
}

/**
 * Por qué no hay que mandarle a esta dirección, o `null` si se puede.
 *
 * Los motivos empiezan con `FRENADO`: así la bandeja distingue lo que frenó
 * Halley de lo que rechazó Resend, que se lee distinto.
 */
export async function motivoParaNoMandar(email: string) {
  const dominio = email.split("@")[1]?.trim();
  if (!dominio) return `${FRENADO}: la dirección no tiene dominio.`;

  if ((await dominioRecibe(dominio)) === false) {
    return `${FRENADO}: el dominio ${dominio} no recibe correo. Seguramente la dirección está mal escrita.`;
  }
  return null;
}
