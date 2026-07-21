import QRCode from "qrcode";

/**
 * QR de pago.
 *
 * En la demo el QR codifica el CVU y el alias como texto: alcanza para que en
 * la presentación se vea el flujo completo y para que cualquier lector muestre
 * los datos de la transferencia. El QR interoperable de verdad (payload EMVCo)
 * lo devuelve Talo junto con el CVU — cuando esté la cuenta activa, se
 * reemplaza el contenido de esta función por ese payload y nada más cambia.
 */
export async function qrDePago(datos: {
  cvu: string;
  alias: string;
  monto: number;
  titular: string;
}) {
  const contenido = [
    "TRANSFERENCIA HALLEY",
    `ALIAS ${datos.alias}`,
    `CVU ${datos.cvu}`,
    `MONTO ${datos.monto}`,
    `TITULAR ${datos.titular}`,
  ].join("\n");

  return QRCode.toString(contenido, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });
}
