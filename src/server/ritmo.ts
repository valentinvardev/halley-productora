import "server-only";

import { dominioDelRemitente } from "~/app/_datos/correo";
import { env } from "~/env";
import { leerCorreo } from "./correo-ajustes";
import { db } from "./db";

/**
 * El ritmo de los envíos en masa.
 *
 * Lo que más castiga la reputación de un dominio no es el volumen sino el salto:
 * pasar de cincuenta correos por día a novecientos en una tarde, como pasó el
 * 24 de octubre de 2026. Los proveedores leen eso como lo que hace un spammer
 * con una lista comprada. Por eso un envío en masa no sale de golpe: cada
 * correo se programa en Resend con su hora, espaciados, y sólo en horario de
 * día. Resend los guarda y los entrega a esa hora, así que nadie tiene que
 * dejar una pantalla abierta.
 *
 * Los avisos que pide una familia (el link para entrar, un comprobante) nunca
 * pasan por acá: salen en el momento.
 */

/** Cuántos por hora, si nadie eligió otra cosa. Es el tope que Resend sugiere
 *  para el primer día de un dominio con historial. */
export const RITMO_POR_DEFECTO = 100;

/**
 * El calentamiento de un dominio nuevo, día por día: tope diario y por hora.
 *
 * Son los números de la guía de Resend. Para los tres primeros días Resend da
 * el tope diario y no el horario; uso 50 por hora, el del cuarto día, porque
 * un tope diario solo no impide mandarlos todos en diez minutos.
 */
const TOPE_DIA = [150, 250, 400, 700, 1000, 1500, 2000];
const TOPE_HORA = [50, 50, 50, 50, 75, 100, 150];

/** Halley está en Argentina, que no tiene horario de verano: UTC-3 fijo. */
const DESFASE_AR = 3 * 3_600_000;
const DESDE_HORA = 8;
const HASTA_HORA = 21;
const DIA = 86_400_000;

/** El día argentino de una fecha, como "2026-11-07". */
export const diaAr = (d: Date) =>
  new Date(d.getTime() - DESFASE_AR).toISOString().slice(0, 10);
const horaAr = (d: Date) => new Date(d.getTime() - DESFASE_AR).getUTCHours();
/** Las 8 de la mañana argentinas de un día "YYYY-MM-DD". */
const ochoDe = (dia: string) =>
  new Date(
    Date.parse(`${dia}T00:00:00Z`) + DESFASE_AR + DESDE_HORA * 3_600_000,
  );

/**
 * Corre una hora al horario de día: antes de las 8 pasa a las 8, y después de
 * las 21 a las 8 del día siguiente.
 *
 * Un correo que llega a las 3 de la mañana no se abre a las 3: se abre a la
 * mañana, debajo de los que llegaron después. Los proveedores miran si los
 * correos de un remitente se abren, y uno que llega cuando la gente lee tiene
 * más chances.
 */
function enHorario(t: Date) {
  const h = horaAr(t);
  if (h < DESDE_HORA) return ochoDe(diaAr(t));
  if (h >= HASTA_HORA) return ochoDe(diaAr(new Date(t.getTime() + DIA)));
  return t;
}

export type PlanDeRitmo = {
  /** Correos por hora elegidos; 0 es sin ritmo. */
  ritmo: number;
  /** Desde qué día cuenta el calentamiento, o `null` si el dominio ya tiene historial. */
  primerDia: string | null;
  /** El último turno ya dado a un correo de este dominio, si hay. */
  ultimo: Date | null;
  /** Cuántos correos en masa ya tiene cada día, desde hoy. */
  porDia: Map<string, number>;
};

/** El día de calentamiento (1 a 7) de una fecha, o `null` si ya pasó. */
function diaDeCalentamiento(plan: PlanDeRitmo, t: Date) {
  if (!plan.primerDia) return null;
  const n =
    Math.round((Date.parse(diaAr(t)) - Date.parse(plan.primerDia)) / DIA) + 1;
  return n >= 1 && n <= TOPE_DIA.length ? n : null;
}

/**
 * Los próximos `cantidad` turnos, sin escribir nada.
 *
 * Es una función pura a propósito: la usa el envío para darle su hora a cada
 * correo, y la pantalla para decir antes de mandar hasta cuándo va a tardar.
 * Si fueran dos cuentas distintas, tarde o temprano dirían cosas distintas.
 */
export function siguientesTurnos(
  plan: PlanDeRitmo,
  cantidad: number,
  ahora: Date,
): Date[] {
  if (!plan.ritmo) return Array.from({ length: cantidad }, () => ahora);

  const porDia = new Map(plan.porDia);
  const espacio = (t: Date) => {
    const dia = diaDeCalentamiento(plan, t);
    const porHora = dia
      ? Math.min(plan.ritmo, TOPE_HORA[dia - 1]!)
      : plan.ritmo;
    return 3_600_000 / porHora;
  };

  let t =
    plan.ultimo &&
    plan.ultimo.getTime() + espacio(plan.ultimo) > ahora.getTime()
      ? new Date(plan.ultimo.getTime() + espacio(plan.ultimo))
      : ahora;

  const turnos: Date[] = [];
  for (let i = 0; i < cantidad; i++) {
    // Al horario de día, y si el día ya llenó su tope de calentamiento, al
    // siguiente. El tope de vueltas es un pasamanos: siete días alcanzan para
    // salir de cualquier calentamiento.
    for (let vuelta = 0; vuelta < 40; vuelta++) {
      t = enHorario(t);
      const dia = diaDeCalentamiento(plan, t);
      if (!dia || (porDia.get(diaAr(t)) ?? 0) < TOPE_DIA[dia - 1]!) break;
      t = ochoDe(diaAr(new Date(t.getTime() + DIA)));
    }
    turnos.push(t);
    porDia.set(diaAr(t), (porDia.get(diaAr(t)) ?? 0) + 1);
    t = new Date(t.getTime() + espacio(t));
  }
  return turnos;
}

/* ------------------------------------------------------------ la base */

/** Las notificaciones que salieron, o van a salir, desde un dominio. */
const desdeDominio = (dominio: string) => ({
  OR: [
    { remitente: { endsWith: `@${dominio}>` } },
    { remitente: { endsWith: `@${dominio}` } },
  ],
  errorEnvio: null,
  canceladaEl: null,
});

export async function ritmoElegido() {
  const { ritmo } = await leerCorreo();
  const n = Number.parseInt(ritmo, 10);
  return Number.isFinite(n) && n >= 0 ? n : RITMO_POR_DEFECTO;
}

/**
 * Lo que hace falta para repartir turnos desde un remitente.
 *
 * El dominio de `EMAIL_FROM` no se calienta nunca: manda desde julio de 2026,
 * de antes de que cada correo anotara su remitente. Cualquier otro se calienta
 * durante sus primeros siete días de uso.
 */
export async function cargarPlan(remitente: string): Promise<PlanDeRitmo> {
  const dominio = dominioDelRemitente(remitente);
  const hoy = ochoDe(diaAr(new Date())).getTime() - DESDE_HORA * 3_600_000;

  const [ritmo, ultimo, primero, porDia] = await Promise.all([
    ritmoElegido(),
    db.notificacion.findFirst({
      where: { ...desdeDominio(dominio), programadaPara: { not: null } },
      orderBy: { programadaPara: "desc" },
      select: { programadaPara: true },
    }),
    dominio === dominioDelRemitente(env.EMAIL_FROM)
      ? null
      : db.notificacion.aggregate({
          where: { ...desdeDominio(dominio), enviadoEl: { not: null } },
          _min: { enviadoEl: true, programadaPara: true },
        }),
    db.notificacion.findMany({
      where: {
        ...desdeDominio(dominio),
        programadaPara: { gte: new Date(hoy) },
      },
      select: { programadaPara: true },
    }),
  ]);

  // El primer día de uso es el del primer correo, enviado o programado.
  let primerDia: string | null = null;
  if (dominio !== dominioDelRemitente(env.EMAIL_FROM)) {
    const fechas = [primero?._min.enviadoEl, primero?._min.programadaPara]
      .filter((f): f is Date => !!f)
      .map((f) => f.getTime());
    const desde = fechas.length ? new Date(Math.min(...fechas)) : new Date();
    const dias =
      (Date.parse(diaAr(new Date())) - Date.parse(diaAr(desde))) / DIA;
    primerDia = dias < TOPE_DIA.length ? diaAr(desde) : null;
  }

  const cuenta = new Map<string, number>();
  for (const n of porDia) {
    const d = diaAr(n.programadaPara!);
    cuenta.set(d, (cuenta.get(d) ?? 0) + 1);
  }

  return {
    ritmo,
    primerDia,
    ultimo: ultimo?.programadaPara ?? null,
    porDia: cuenta,
  };
}

/** El turno del próximo correo en masa desde este remitente. */
export async function turnoMasivo(remitente: string) {
  const plan = await cargarPlan(remitente);
  return siguientesTurnos(plan, 1, new Date())[0]!;
}

/** Hasta cuándo tardarían `cantidad` correos en masa más, sin escribir nada. */
export async function estimarCola(remitente: string, cantidad: number) {
  const plan = await cargarPlan(remitente);
  const turnos = siguientesTurnos(plan, Math.max(cantidad, 1), new Date());
  return {
    ritmo: plan.ritmo,
    termina: turnos.at(-1)!,
    calentamiento: plan.primerDia
      ? {
          dominio: dominioDelRemitente(remitente),
          dia: diaDeCalentamiento(plan, new Date()),
        }
      : null,
  };
}

/**
 * Hasta cuándo hay correos en cola, o `null` si no queda ninguno.
 *
 * Es lo que se le dice a quien acaba de mandar en masa: "salen de a poco hasta
 * las 16:40". Sin eso, ver "60 invitaciones" y que a la familia no le llegue
 * nada en diez minutos parece una falla.
 */
export async function finDeLaCola() {
  const ultimo = await db.notificacion.findFirst({
    where: {
      programadaPara: { gt: new Date() },
      canceladaEl: null,
      errorEnvio: null,
    },
    orderBy: { programadaPara: "desc" },
    select: { programadaPara: true },
  });
  return ultimo?.programadaPara ?? null;
}

/** Los topes del calentamiento, para que la pantalla los muestre. */
export const CALENTAMIENTO = TOPE_DIA.map((dia, i) => ({
  dia: i + 1,
  porDia: dia,
  porHora: TOPE_HORA[i]!,
}));
