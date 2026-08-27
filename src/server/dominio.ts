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
  estado: EstadoCuota;
};

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
 * Vale para toda instancia de pago vencida, seña incluida. La seña no es una
 * cuota, pero es algo que había que pagar y no se pagó.
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
 * Reparte lo que el alumno pagó sobre su plan de cuotas, de la más vieja a la
 * más nueva.
 *
 * El estado de cada cuota no se guarda en la base: se deriva de esta cuenta.
 * Así un pago parcial, uno de más o dos cuotas juntas se acomodan solos, y el
 * panel no puede terminar diciendo algo distinto de lo que dicen los pagos.
 *
 * El recargo por mora se suma al monto exigible de cada cuota impaga, así que
 * también sale derivado: no hay un campo "interés" que actualizar ni que se
 * pueda desincronizar. Se cobra oldest-first junto con el capital.
 */
export function imputarPagos(cuotas: CuotaPlan[], totalPagado: number) {
  const ahora = new Date();
  let resto = totalPagado;

  const imputadas: CuotaImputada[] = [...cuotas]
    .sort((a, b) => a.numero - b.numero)
    .map((cuota) => {
      const monto = Number(cuota.monto);
      const vencida = cuota.venceEl.getTime() < ahora.getTime();
      // El recargo sólo tiene sentido sobre lo que sigue impago; una cuota ya
      // cubierta no acumula mora hacia atrás.
      const recargoPosible = vencida
        ? monto * recargoPorMora(cuota.venceEl, ahora)
        : 0;
      const exigible = monto + recargoPosible;

      const aplicado = Math.min(Math.max(resto, 0), exigible);
      resto -= aplicado;

      // Tolerancia de un centavo: los decimales no tienen por qué cerrar exacto.
      const pagada = aplicado >= exigible - 0.01;
      const estado: EstadoCuota = pagada
        ? "PAGADA"
        : vencida
          ? "VENCIDA"
          : "PENDIENTE";

      // Si terminó saldada, el recargo no se cobró: no se muestra.
      const recargo = pagada ? 0 : recargoPosible;

      return {
        id: cuota.id,
        numero: cuota.numero,
        monto,
        venceEl: cuota.venceEl,
        recargo,
        aplicado,
        saldo: Math.max(monto + recargo - aplicado, 0),
        estado,
      };
    });

  const total = imputadas.reduce((t, c) => t + c.monto, 0);
  const recargo = imputadas.reduce((t, c) => t + c.recargo, 0);
  const pagado = imputadas.reduce((t, c) => t + c.aplicado, 0);

  return {
    cuotas: imputadas,
    total,
    /** Recargo por mora todavía sin pagar, sumado sobre todo el plan. */
    recargo,
    pagado,
    /** Lo que falta, capital impago más recargo. */
    deuda: imputadas.reduce((t, c) => t + c.saldo, 0),
    /** Transfirió de más: queda a cuenta de las cuotas que vengan. */
    aFavor: Math.max(resto, 0),
    /** La primera sin saldar: es la que hay que pagar ahora. */
    proxima: imputadas.find((c) => c.estado !== "PAGADA") ?? null,
    alDia: imputadas.every((c) => c.estado !== "VENCIDA"),
  };
}

export function sumarPagos(pagos: { monto: unknown }[]) {
  return pagos.reduce((t, p) => t + Number(p.monto), 0);
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
