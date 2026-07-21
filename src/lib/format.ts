const pesosFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function pesos(monto: number) {
  return pesosFmt.format(monto);
}

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function fecha(d: Date | string) {
  return fechaFmt.format(new Date(d));
}

const fechaHoraFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function fechaHora(d: Date | string) {
  return fechaHoraFmt.format(new Date(d));
}

/**
 * Numeración de hoja de contacto: 01A, 02A … 36A, 01B, 02B …
 * Se usa como identificador visual de cada fila del panel.
 */
export function cuadro(indice: number) {
  const rollo = String.fromCharCode(65 + Math.floor(indice / 36));
  const numero = String((indice % 36) + 1).padStart(2, "0");
  return `${numero}${rollo}`;
}
