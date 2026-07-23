import { env } from "~/env";

/**
 * La plantilla de los emails de Halley.
 *
 * Sigue el manual de marca: negro y gris oscuro (#1C1C1C), crema (#E3DAC9),
 * blanco, hairlines de 1px y esquinas rectas. Nada de color de acento salvo el
 * rojo de la marca, reservado para los avisos de mora.
 *
 * Está escrita para correo, que es su propio mundo: tablas en vez de flex,
 * estilos inline porque muchos clientes tiran el `<style>`, y ancho fijo de
 * 600px. Bebas no se puede cargar en un email, así que los títulos van en una
 * sans en versalitas con tracking abierto, que evoca el rótulo sin depender de
 * una fuente que el cliente no tiene.
 *
 * El texto plano sigue viajando aparte (es el registro de la bandeja y el
 * fallback); esto es sólo la cara HTML.
 */

const TINTA = "#1c1c1c";
const CREMA = "#e3dac9";
const PAPEL = "#f4f1ea";
const GRIS = "#6f6a60";
const MARCA = "#c0392b";

const SANS =
  "'Helvetica Neue', Helvetica, Arial, sans-serif";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type Destacado = {
  rotulo: string;
  valor: string;
  pie?: string;
  /** Tiñe el borde y el rótulo de rojo: para vencimientos. */
  alerta?: boolean;
};

export function plantillaEmail(opts: {
  preheader: string;
  titulo: string;
  saludo?: string;
  parrafos: string[];
  destacado?: Destacado;
  boton?: { texto: string; url: string };
  nota?: string;
  /**
   * Invita a responder el correo. Va en los que le hablan a una familia: si no
   * se lo decimos, nadie contesta un mail que parece automático.
   */
  responder?: boolean;
}): string {
  const logo = `${env.NEXT_PUBLIC_APP_URL}/marca/palabra-oscuro.png`;

  const parrafosHtml = opts.parrafos
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.6;color:${TINTA};">${esc(
          p,
        )}</p>`,
    )
    .join("");

  const destacadoHtml = opts.destacado
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
      <tr><td style="border:1px solid ${opts.destacado.alerta ? MARCA : TINTA};padding:18px 20px;">
        <div style="font-family:${SANS};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${
          opts.destacado.alerta ? MARCA : GRIS
        };">${esc(opts.destacado.rotulo)}</div>
        <div style="margin-top:6px;font-family:${SANS};font-size:30px;font-weight:700;color:${TINTA};">${esc(
          opts.destacado.valor,
        )}</div>
        ${
          opts.destacado.pie
            ? `<div style="margin-top:6px;font-family:${SANS};font-size:13px;color:${GRIS};">${esc(
                opts.destacado.pie,
              )}</div>`
            : ""
        }
      </td></tr>
    </table>`
    : "";

  // Botón "a prueba de balas": tabla con bgcolor para que Outlook lo pinte.
  const botonHtml = opts.boton
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 26px;">
      <tr><td bgcolor="${TINTA}" style="background:${TINTA};">
        <a href="${esc(opts.boton.url)}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${SANS};font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;">${esc(
          opts.boton.texto,
        )}</a>
      </td></tr>
    </table>`
    : "";

  const notaHtml = opts.nota
    ? `<p style="margin:20px 0 0;padding-top:18px;border-top:1px solid #e3dfd4;font-family:${SANS};font-size:12.5px;line-height:1.55;color:${GRIS};">${esc(
        opts.nota,
      )}</p>`
    : "";

  const saludoHtml = opts.saludo
    ? `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.6;color:${TINTA};">${esc(
        opts.saludo,
      )}</p>`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${esc(opts.titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${CREMA};">
  <!-- preheader: el texto de vista previa, oculto -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(
    opts.preheader,
  )}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREMA};">
    <tr><td align="center" style="padding:32px 16px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;border:1px solid ${TINTA};background:#ffffff;">

        <!-- header: banda oscura con el logotipo crema -->
        <tr><td align="center" bgcolor="${TINTA}" style="background:${TINTA};padding:26px 24px;">
          <img src="${logo}" width="150" alt="Halley Audiovisual" style="display:block;width:150px;height:auto;border:0;">
        </td></tr>

        <!-- cuerpo -->
        <tr><td style="padding:34px 36px 30px;">
          <h1 style="margin:0 0 20px;font-family:${SANS};font-size:22px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${TINTA};">${esc(
            opts.titulo,
          )}</h1>
          ${saludoHtml}
          ${parrafosHtml}
          ${destacadoHtml}
          ${botonHtml}
          ${notaHtml}
        </td></tr>

        <!-- footer -->
        <tr><td style="padding:20px 36px 26px;border-top:1px solid ${TINTA};background:${PAPEL};">
          ${
            opts.responder
              ? `<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #ded9cd;font-family:${SANS};font-size:12.5px;line-height:1.55;color:${TINTA};"><strong>¿Tenés una duda?</strong> Respondé este correo y te contestamos.</div>`
              : ""
          }
          <div style="font-family:${SANS};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${GRIS};">Halley Audiovisual · Córdoba, Argentina</div>
          <div style="margin-top:6px;font-family:${SANS};font-size:11.5px;line-height:1.5;color:${GRIS};">Dron, fotografía y video. Los momentos son fugaces: Halley los hace eternos.</div>
        </td></tr>

      </table>

    </td></tr>
  </table>
</body>
</html>`;
}
