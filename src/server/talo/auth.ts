import "server-only";

import type { CredencialesTalo } from "./types";

/**
 * Token de Talo, por cuenta.
 *
 * Talo no da una API key fija: se canjean client_id + client_secret por un token
 * que dura una hora. Pedir uno nuevo en cada llamada sería un viaje de más por
 * operación, así que se guarda y se renueva cuando está por vencer.
 *
 * La caché va por cuenta y no una sola global: con varios socios, un token
 * compartido haría que las operaciones de uno salieran firmadas por otro.
 *
 * El margen es generoso a propósito: un token que vence entre que lo leemos y lo
 * usamos hace fallar un cobro, y eso vale mucho más que una llamada extra.
 */

const MARGEN_MS = 5 * 60 * 1000;

const cache = new Map<string, { token: string; venceEl: number }>();
/** Renovaciones en curso, para que diez llamadas juntas pidan un solo token. */
const enVuelo = new Map<string, Promise<string>>();

/** El `exp` del JWT, que es la única fuente confiable de cuándo vence. */
function vencimientoDe(token: string) {
  try {
    const cuerpo = token.replace(/^TL-/, "").split(".")[1];
    if (!cuerpo) return null;
    const datos = JSON.parse(
      Buffer.from(cuerpo, "base64").toString("utf8"),
    ) as { exp?: number };
    return datos.exp ? datos.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function pedirToken(cred: CredencialesTalo): Promise<string> {
  const res = await fetch(`${cred.apiUrl}/users/${cred.userId}/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: cred.clientId,
      client_secret: cred.clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`Talo rechazó las credenciales (${res.status})`);
  }

  const json = (await res.json()) as { data?: { token?: string } };
  const token = json.data?.token;
  if (!token) throw new Error("Talo no devolvió token");

  // Si el JWT no dice cuándo vence, se asume media hora: menos que la hora real,
  // así nunca se usa uno vencido.
  cache.set(cred.cacheId, {
    token,
    venceEl: vencimientoDe(token) ?? Date.now() + 30 * 60 * 1000,
  });
  return token;
}

/** El token vigente de esta cuenta, renovándolo si hace falta. */
export async function tokenTalo(cred: CredencialesTalo): Promise<string> {
  const guardado = cache.get(cred.cacheId);
  if (guardado && guardado.venceEl - Date.now() > MARGEN_MS) {
    return guardado.token;
  }

  // Sin esto, un pico de llamadas dispara una tanda de canjes en paralelo.
  const yaVa = enVuelo.get(cred.cacheId);
  if (yaVa) return yaVa;

  const promesa = pedirToken(cred).finally(() => enVuelo.delete(cred.cacheId));
  enVuelo.set(cred.cacheId, promesa);
  return promesa;
}

/** Sólo para pruebas: olvida los tokens guardados. */
export function olvidarTokens() {
  cache.clear();
  enVuelo.clear();
}
