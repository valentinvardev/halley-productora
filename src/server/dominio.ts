import { env } from "~/env";

/**
 * Reglas de negocio compartidas entre routers, webhook y páginas.
 */

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
  monto: number;
  venceEl: Date;
  /** Cuánto de esta cuota quedó cubierto. */
  aplicado: number;
  saldo: number;
  estado: EstadoCuota;
};

/**
 * Reparte lo que el alumno pagó sobre su plan de cuotas, de la más vieja a la
 * más nueva.
 *
 * El estado de cada cuota no se guarda en la base: se deriva de esta cuenta.
 * Así un pago parcial, uno de más o dos cuotas juntas se acomodan solos, y el
 * panel no puede terminar diciendo algo distinto de lo que dicen los pagos.
 */
export function imputarPagos(cuotas: CuotaPlan[], totalPagado: number) {
  const ahora = Date.now();
  let resto = totalPagado;

  const imputadas: CuotaImputada[] = [...cuotas]
    .sort((a, b) => a.numero - b.numero)
    .map((cuota) => {
      const monto = Number(cuota.monto);
      const aplicado = Math.min(Math.max(resto, 0), monto);
      resto -= aplicado;

      // Tolerancia de un centavo: los decimales no tienen por qué cerrar exacto.
      const pagada = aplicado >= monto - 0.01;
      const estado: EstadoCuota = pagada
        ? "PAGADA"
        : cuota.venceEl.getTime() < ahora
          ? "VENCIDA"
          : "PENDIENTE";

      return {
        id: cuota.id,
        numero: cuota.numero,
        monto,
        venceEl: cuota.venceEl,
        aplicado,
        saldo: Math.max(monto - aplicado, 0),
        estado,
      };
    });

  const total = imputadas.reduce((t, c) => t + c.monto, 0);

  return {
    cuotas: imputadas,
    total,
    pagado: Math.min(totalPagado, total),
    deuda: Math.max(total - totalPagado, 0),
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
