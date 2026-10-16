import { env } from "~/env";

/**
 * Reglas de negocio compartidas entre routers, webhook y páginas.
 */

/**
 * Cuántas cuentas pueden gestionar la cuota de un mismo alumno. Da lugar a los
 * dos padres y a un tercero (una abuela, un tutor), que es donde se corta lo
 * razonable: más que eso deja de ser una familia y empieza a ser una filtración.
 */
export const MAX_RESPONSABLES = 3;

export type EstadoCuota = "PENDIENTE" | "PAGADA" | "VENCIDA";

type CuotaPlan = {
  id: string;
  numero: number;
  monto: unknown;
  venceEl: Date;
  /** Si a este alumno se le perdonó la mora de esta cuota. */
  sinMora?: boolean;
  /** La mora congelada el día que se cubrió el capital; nulo si sigue viva. */
  recargoFijado?: unknown | null;
};

/**
 * Lo que un alumno paga distinto del resto del grupo, para una cuota.
 *
 * Cada campo en nulo quiere decir "lo que dice el grupo", así que ajustarle el
 * monto a alguien no le congela la fecha.
 */
export type AjusteCuota = {
  cuotaId: string;
  monto: unknown | null;
  venceEl: Date | null;
  /** La mora de esta cuota, perdonada. A diferencia de los otros dos, no es
      un valor que reemplaza al del grupo: el grupo no tiene mora propia. */
  sinMora: boolean;
  /** La mora congelada el día que un pago cubrió el capital. Nulo si sigue
      impaga, y entonces la mora se deriva de la fecha y de hoy. */
  recargoFijado?: unknown | null;
};

export type CuotaImputada = {
  id: string;
  numero: number;
  /** El valor original de la cuota, sin recargo. */
  monto: number;
  venceEl: Date;
  /** Recargo por mora vigente hoy sobre esta cuota, en pesos. 0 si está al día. */
  recargo: number;
  /** Cuánto de la cuota (con recargo) quedó cubierto. */
  aplicado: number;
  saldo: number;
  /**
   * Lo que faltaría si no se cobrara la mora: sólo el capital impago.
   *
   * Existe para poder ofrecer las dos cifras al marcar una cuota como pagada
   * sin preguntarle nada más al servidor, y para que el número que se ve
   * antes de confirmar sea exactamente el que se va a registrar.
   */
  saldoSinMora: number;
  estado: EstadoCuota;
};

/**
 * El plan tal como le toca a este alumno.
 *
 * El plan vive en el grupo, pero los precios se negocian por familia, así que
 * encima del plan del grupo van los ajustes de este alumno. Sin ajustes devuelve
 * la misma lista sin copiar nada: el caso de "paga lo que pagan todos" no tiene
 * por qué costar.
 *
 * No se exporta para que la use cualquiera: la usa `imputarPagos`, y ése es el
 * punto. Si resolver los ajustes fuera un paso aparte que hay que acordarse de
 * hacer, el día que alguien lo olvide el panel mostraría un precio y el cobro
 * otro — y eso no falla ruidosamente, falla en silencio y por plata.
 */
function planDelAlumno(
  cuotas: CuotaPlan[],
  ajustes: AjusteCuota[],
): CuotaPlan[] {
  if (ajustes.length === 0) return cuotas;

  const porCuota = new Map(ajustes.map((a) => [a.cuotaId, a]));
  return cuotas.map((c) => {
    const ajuste = porCuota.get(c.id);
    if (!ajuste) return c;
    return {
      ...c,
      monto: ajuste.monto ?? c.monto,
      venceEl: ajuste.venceEl ?? c.venceEl,
      sinMora: ajuste.sinMora,
      recargoFijado: ajuste.recargoFijado ?? null,
    };
  });
}

/**
 * El día del mes en que vence toda cuota: el 20. Lo usa `grupo.crear` al armar
 * el plan y de acá cuenta la mora.
 */
export const DIA_VENCIMIENTO = 20;

/** Lo que se le suma a una cuota por cada mes entero que lleva vencida. */
const MORA_MENSUAL = 0.03;

/** Cuántos meses enteros pasaron desde el vencimiento hasta ahora. */
function mesesVencida(venceEl: Date, ahora: Date) {
  let meses =
    (ahora.getFullYear() - venceEl.getFullYear()) * 12 +
    (ahora.getMonth() - venceEl.getMonth());
  // Todavía no se cumplió el día del mes: descontá el mes en curso.
  if (ahora.getDate() < venceEl.getDate()) meses -= 1;
  return Math.max(meses, 0);
}

/**
 * Recargo por mora, como fracción del monto.
 *
 * Es compuesto: cada mes que la cuota sigue impaga se le aplica el 3% sobre lo
 * que ya venía recargado, no sobre el monto original. A los tres meses no es 9%
 * sino 9,27%; al año no es 36% sino 42,6%. Antes esto era otra cosa —subía
 * parejo del 3% a los dos meses hasta el 5% a los cinco y ahí topaba— y lo
 * cambió Halley: querían que la mora se acumule mes a mes y no que se planche.
 *
 * Sin techo. Es la contracara de que sea compuesta y hay que saberla: una cuota
 * abandonada dos años más que se duplica sola. La decisión es de Halley y es la
 * que hace que atrasarse duela; si algún día quieren ponerle tope, va acá.
 *
 * Corre desde el vencimiento, sin meses de gracia, y cuenta meses enteros: una
 * cuota con diez días de atraso todavía no debe nada. El primer 3% aparece
 * cuando se cumple un mes.
 *
 * Se aplica por cuota y sobre el monto de esa cuota, no sobre la deuda junta.
 * Dos cuotas vencidas hace tres y hace un mes acumulan distinto, que es lo
 * correcto: cada una se atrasó lo suyo.
 *
 * Es una decisión de negocio y vive en un solo lugar a propósito: se cambia acá
 * y lo toman el panel, el cobro y el aviso por igual.
 */
export function recargoPorMora(venceEl: Date, ahora = new Date()) {
  const meses = mesesVencida(venceEl, ahora);
  if (meses <= 0) return 0;
  return Math.pow(1 + MORA_MENSUAL, meses) - 1;
}

/**
 * El próximo salto de la mora de una cuota: qué día se cumple el mes que viene
 * y cuánto recargo va a tener desde entonces, en pesos.
 *
 * Existe para la ficha del alumno. Una cuota vencida hace diez días figura
 * vencida y debe cero de mora, y las dos cosas juntas confunden: parece que la
 * mora no existe o que no se calculó. Decir "desde el 20 suma $ 900" es lo que
 * falta para entender qué se está perdonando cuando se perdona antes de tiempo.
 *
 * Vive acá y no en la pantalla por lo mismo que `recargoPorMora`: el 3% y la
 * regla del mes entero están en un solo lugar.
 */
export function proximaMora(venceEl: Date, monto: number, ahora = new Date()) {
  const meses = mesesVencida(venceEl, ahora);
  const desde = new Date(venceEl);
  desde.setMonth(venceEl.getMonth() + meses + 1);
  return {
    desde,
    recargo: monto * (Math.pow(1 + MORA_MENSUAL, meses + 1) - 1),
  };
}

/**
 * Lo que un alumno pagó, en dos números: el total y cuánto de eso fue mora.
 *
 * Son dos y no uno porque la imputación los reparte distinto: el capital va a
 * las cuotas de la más vieja a la más nueva, y la mora va a las moras fijadas
 * de las cuotas que ya cubrieron su capital. Sumar todo junto era lo que hacía
 * imposible saber qué estaba saldado y qué no.
 */
export type Pagado = { total: number; mora: number };

/**
 * Reparte lo que el alumno pagó sobre su plan de cuotas, de la más vieja a la
 * más nueva.
 *
 * El estado de cada cuota no se guarda en la base: se deriva de esta cuenta.
 * Así un pago parcial, uno de más o dos cuotas juntas se acomodan solos, y el
 * panel no puede terminar diciendo algo distinto de lo que dicen los pagos.
 *
 * La mora tiene dos vidas, y distinguirlas es el punto de toda la función:
 *
 * - Mientras el capital de una cuota sigue impago, la mora está viva: se
 *   deriva del vencimiento y de hoy (3% compuesto por mes entero, sobre el
 *   monto de la cuota), y crece sola.
 * - El día que un pago cubre el capital, la mora que correspondía ese día
 *   queda fijada en la cuota del alumno (`recargoFijado`) y la parte que ese
 *   pago saldó queda anotada en el pago (`recargo`). Desde entonces esa cuota
 *   no vuelve a derivar mora: ni porque pasen los meses ni porque se mueva la
 *   fecha. Si la mora fijada no se pagó entera, lo que falta queda como saldo,
 *   pero congelado.
 *
 * Antes no había dos vidas: se recalculaba todo "a hoy" sobre la suma de lo
 * pagado, sin fechas. Eso hacía que una cuota pagada entera, con su mora del
 * día, volviera a figurar vencida al mes siguiente, porque lo exigible de hoy
 * ya era más que lo que se pagó entonces. Y hacía que mover una fecha para
 * atrás alcanzara también a los que ya habían pagado. Las dos cosas se cierran
 * con lo mismo: recordar qué se saldó.
 *
 * `ahora` se puede pasar para reconstruir el pasado o simular el futuro; por
 * defecto es hoy.
 *
 * Los ajustes del alumno son un parámetro obligatorio y no un paso previo
 * opcional. Es a propósito: son muchos los lugares que imputan, casi todos
 * pasaban el plan del grupo crudo, y con los precios negociados por familia un
 * lugar que se olvide de resolverlos no falla en un caso raro sino en la
 * mayoría. Pedirlos acá hace que el compilador los encuentre a todos. Quien de
 * verdad no tenga ajustes que aplicar pasa una lista vacía y lo dice.
 */
export function imputarPagos(
  cuotasDelGrupo: CuotaPlan[],
  ajustes: AjusteCuota[],
  pagado: Pagado,
  ahora: Date = new Date(),
) {
  // Dos bolsas: el capital y la mora. El capital cubre cuotas en orden; la
  // mora paga las moras fijadas, también en orden.
  let capital = pagado.total - pagado.mora;
  let mora = pagado.mora;

  const imputadas: CuotaImputada[] = [...planDelAlumno(cuotasDelGrupo, ajustes)]
    .sort((a, b) => a.numero - b.numero)
    .map((cuota) => {
      const monto = Number(cuota.monto);
      const vencida = cuota.venceEl.getTime() < ahora.getTime();

      const aplicadoCapital = Math.min(Math.max(capital, 0), monto);
      capital -= aplicadoCapital;
      // Tolerancia de un centavo: los decimales no tienen por qué cerrar exacto.
      const capitalCubierto = aplicadoCapital >= monto - 0.01;

      // La mora de esta cuota, según en qué vida esté. La perdonada no tiene
      // nunca: no es que esté pagada, es que no se le cobra. La fijada vale lo
      // que se escribió el día que se cubrió el capital, aunque hoy la fecha
      // diga otra cosa. La viva se deriva.
      const moraCuota = cuota.sinMora
        ? 0
        : capitalCubierto
          ? cuota.recargoFijado == null
            ? 0
            : Number(cuota.recargoFijado)
          : vencida
            ? monto * recargoPorMora(cuota.venceEl, ahora)
            : 0;

      const aplicadoMora = Math.min(Math.max(mora, 0), moraCuota);
      mora -= aplicadoMora;

      const moraPendiente = moraCuota - aplicadoMora;
      const pagada = capitalCubierto && moraPendiente <= 0.01;
      const estado: EstadoCuota = pagada
        ? "PAGADA"
        : vencida
          ? "VENCIDA"
          : "PENDIENTE";

      // Si terminó saldada, el recargo no se cobró: no se muestra.
      const recargo = pagada ? 0 : moraCuota;
      const aplicado = aplicadoCapital + aplicadoMora;

      return {
        id: cuota.id,
        numero: cuota.numero,
        monto,
        venceEl: cuota.venceEl,
        recargo,
        aplicado,
        saldo: Math.max(monto + recargo - aplicado, 0),
        saldoSinMora: Math.max(monto - aplicadoCapital, 0),
        estado,
      };
    });

  const total = imputadas.reduce((t, c) => t + c.monto, 0);
  const recargo = imputadas.reduce((t, c) => t + c.recargo, 0);
  const pagadoTotal = imputadas.reduce((t, c) => t + c.aplicado, 0);

  return {
    cuotas: imputadas,
    total,
    /** Recargo por mora todavía sin pagar, sumado sobre todo el plan. */
    recargo,
    pagado: pagadoTotal,
    /** Lo que falta, capital impago más recargo. */
    deuda: imputadas.reduce((t, c) => t + c.saldo, 0),
    /** Lo que faltaría perdonándole toda la mora: sólo el capital. */
    deudaSinMora: imputadas.reduce((t, c) => t + c.saldoSinMora, 0),
    /** Transfirió de más: queda a cuenta de las cuotas que vengan. */
    aFavor: Math.max(capital, 0) + Math.max(mora, 0),
    /** La primera sin saldar: es la que hay que pagar ahora. */
    proxima: imputadas.find((c) => c.estado !== "PAGADA") ?? null,
    alDia: imputadas.every((c) => c.estado !== "VENCIDA"),
  };
}

/**
 * Qué parte de un pago nuevo es mora y qué cuotas fijan la suya con él.
 *
 * Se llama al registrar un pago, con el plan imputado de antes de ese pago, y
 * devuelve lo que hay que escribir: el `recargo` del pago y las cuotas cuyo
 * capital se cubre recién ahora, con la mora que les corresponde hoy para
 * dejarla fijada. Una cuota cuyo capital ya estaba cubierto no se vuelve a
 * fijar: sólo se le paga la mora que tenía pendiente.
 *
 * Es la misma caminata que hace la imputación, pero sobre lo que entra, y por
 * eso vive al lado: si un día se cambia cómo se reparte, se cambia acá también
 * o lo registrado deja de coincidir con lo derivado.
 */
export function liquidarPago(
  plan: ReturnType<typeof imputarPagos>,
  monto: number,
) {
  let resto = monto;
  let recargoDelPago = 0;
  const fijar: { cuotaId: string; recargo: number }[] = [];

  for (const c of plan.cuotas) {
    if (resto <= 0.01) break;
    if (c.estado === "PAGADA") continue;

    const capitalFaltante = c.saldoSinMora;
    const aCapital = Math.min(resto, capitalFaltante);
    resto -= aCapital;
    if (aCapital < capitalFaltante - 0.01) break;

    // Lo que esta cuota tiene de mora sin pagar hoy: la viva, si recién se
    // cubre el capital, o lo que quedaba de la fijada.
    const moraPendiente = Math.max(c.saldo - c.saldoSinMora, 0);
    if (capitalFaltante > 0.01)
      fijar.push({ cuotaId: c.id, recargo: moraPendiente });

    const aMora = Math.min(resto, moraPendiente);
    resto -= aMora;
    recargoDelPago += aMora;
  }

  return { recargo: recargoDelPago, fijar };
}

/**
 * Los ajustes con las moras recién fijadas puestas encima, para reimputar en
 * memoria sin volver a leer la base.
 */
export function conFijados(
  ajustes: AjusteCuota[],
  fijar: { cuotaId: string; recargo: number }[],
): AjusteCuota[] {
  if (fijar.length === 0) return ajustes;
  const porCuota = new Map(fijar.map((f) => [f.cuotaId, f.recargo]));
  const vistos = new Set<string>();
  const salida = ajustes.map((a) => {
    vistos.add(a.cuotaId);
    return porCuota.has(a.cuotaId)
      ? { ...a, recargoFijado: porCuota.get(a.cuotaId) }
      : a;
  });
  for (const [cuotaId, recargo] of porCuota) {
    if (!vistos.has(cuotaId)) {
      salida.push({
        cuotaId,
        monto: null,
        venceEl: null,
        sinMora: false,
        recargoFijado: recargo,
      });
    }
  }
  return salida;
}

export function sumarPagos(
  pagos: { monto: unknown; recargo: unknown }[],
): Pagado {
  return pagos.reduce(
    (t, p) => ({
      total: t.total + Number(p.monto),
      mora: t.mora + Number(p.recargo ?? 0),
    }),
    { total: 0, mora: 0 },
  );
}

export function linkAlumno(token: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/p/${token}`;
}

export function linkGrupo(slug: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/g/${slug}`;
}

/**
 * Registro con el alumno ya elegido. Es el link que se le manda a cada familia:
 * lleva a crear la cuenta —no a pagar suelto— con su hijo preseleccionado.
 */
export function linkRegistroAlumno(slug: string, alumnoId: string) {
  return `${linkGrupo(slug)}?alumno=${alumnoId}`;
}
