import "server-only";

import { env } from "~/env";

/**
 * Token de Talo.
 *
 * Talo no da una API key fija: se canjean client_id + client_secret por un token
 * que dura una hora. Pedir uno nuevo en cada llamada sería un viaje de más por
 * operación, así que se guarda en memoria y se renueva cuando está por vencer.
 *
 * El margen es generoso a propósito: un token que vence entre que lo leemos y
 * lo usamos hace fallar un cobro, y eso vale mucho más que una llamada extra.
 */

const MARGEN_MS = 5 * 60 * 1000;

let cache: { token: string; venceEl: number } | null = null;
/** Renovaciones en curso, para que diez llamadas juntas pidan un solo token. */
let enVuelo: Promise<string> | null = null;

export function taloConfigurado() {
  return Boolean(
    env.TALO_CLIENT_ID && env.TALO_CLIENT_SECRET && env.TALO_USER_ID,
  );
}

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

async function pedirToken(): Promise<string> {
  if (!taloConfigurado()) {
    throw new Error(
      "TALO_MODE=real requiere TALO_CLIENT_ID, TALO_CLIENT_SECRET y TALO_USER_ID.",
    );
  }

  const res = await fetch(
    `${env.TALO_API_URL}/users/${env.TALO_USER_ID}/tokens`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.TALO_CLIENT_ID,
        client_secret: env.TALO_CLIENT_SECRET,
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Talo rechazó las credenciales (${res.status})`);
  }

  const json = (await res.json()) as { data?: { token?: string } };
  const token = json.data?.token;
  if (!token) throw new Error("Talo no devolvió token");

  // Si el JWT no dice cuándo vence, se asume media hora: menos que la hora real,
  // así nunca se usa uno vencido.
  cache = {
    token,
    venceEl: vencimientoDe(token) ?? Date.now() + 30 * 60 * 1000,
  };
  return token;
}

/** El token vigente, renovándolo si hace falta. */
export async function tokenTalo(): Promise<string> {
  if (cache && cache.venceEl - Date.now() > MARGEN_MS) return cache.token;

  // Sin esto, un pico de llamadas dispara una tanda de canjes en paralelo.
  enVuelo ??= pedirToken().finally(() => {
    enVuelo = null;
  });
  return enVuelo;
}

/** Sólo para pruebas: olvida el token guardado. */
export function olvidarToken() {
  cache = null;
  enVuelo = null;
}
