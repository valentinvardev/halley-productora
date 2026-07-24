import "server-only";

/**
 * Freno de fuerza bruta para las puertas con contraseña.
 *
 * Una clave sin límite de intentos no es una clave: con unos pocos miles de
 * pruebas por minuto, cualquier palabra corta cae. Esto cuenta los fallos por
 * llave (IP + puerta) y va cerrando el paso.
 *
 * Vive en memoria del proceso a propósito: no necesita Redis para un panel con
 * un puñado de usuarios, y el costo de equivocarse es que alguien espere de
 * más. Si algún día corren varias instancias de la app, este contador deja de
 * ser global y hay que moverlo a un almacén compartido.
 */

type Registro = { fallos: number; hasta: number };

const registros = new Map<string, Registro>();

/** Después de estos fallos seguidos se empieza a bloquear. */
const TOLERANCIA = 5;
/** Cuánto dura el bloqueo, creciendo con los fallos, hasta el tope. */
const BLOQUEO_BASE_MS = 30_000;
const BLOQUEO_MAX_MS = 15 * 60_000;
/** Un registro sin actividad se olvida. */
const OLVIDO_MS = 60 * 60_000;

function limpiarViejos(ahora: number) {
  // Barrido barato: sin esto, un atacante que rota IPs hace crecer el mapa sin
  // fin, que es su propia forma de ataque.
  if (registros.size < 5_000) return;
  for (const [k, v] of registros) {
    if (v.hasta + OLVIDO_MS < ahora) registros.delete(k);
  }
}

/**
 * ¿Está bloqueada esta llave? Devuelve los segundos que faltan, o 0 si puede
 * intentar.
 */
export function esperaRestante(llave: string) {
  const reg = registros.get(llave);
  if (!reg) return 0;
  const falta = reg.hasta - Date.now();
  return falta > 0 ? Math.ceil(falta / 1000) : 0;
}

/** Registra un intento fallido y devuelve los segundos de espera que impone. */
export function registrarFallo(llave: string) {
  const ahora = Date.now();
  limpiarViejos(ahora);

  const reg = registros.get(llave) ?? { fallos: 0, hasta: 0 };
  reg.fallos += 1;

  if (reg.fallos > TOLERANCIA) {
    const exceso = reg.fallos - TOLERANCIA;
    const castigo = Math.min(BLOQUEO_BASE_MS * 2 ** (exceso - 1), BLOQUEO_MAX_MS);
    reg.hasta = ahora + castigo;
  }

  registros.set(llave, reg);
  return esperaRestante(llave);
}

/** Acertó: se limpia el historial de esa llave. */
export function registrarExito(llave: string) {
  registros.delete(llave);
}

/**
 * De qué origen viene el pedido, para contar por atacante y no por sitio.
 *
 * Detrás de nginx la IP real llega en X-Forwarded-For; el primer valor es el
 * cliente. Sin encabezado se cae a una llave común: peor discriminación, pero
 * el freno sigue puesto.
 */
export function origenDe(headers: Headers) {
  const reenviado = headers.get("x-forwarded-for");
  const ip = reenviado?.split(",")[0]?.trim();
  return ip ?? headers.get("x-real-ip") ?? "desconocido";
}
