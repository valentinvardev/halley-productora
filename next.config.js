/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/**
 * Cabeceras de seguridad.
 *
 * Son la red de contención de lo que no se ve venir: si algún día entra una
 * cadena controlada por un tercero en una pantalla, la CSP le saca el filo; si
 * alguien nos mete en un iframe para superponer botones, `frame-ancestors` lo
 * corta; y `nosniff` evita que un archivo subido se interprete como otra cosa.
 *
 * La CSP admite 'unsafe-inline' en estilos y scripts porque Next inyecta ambos
 * en línea (el script del tema, los estilos en el head). No es la versión más
 * estricta posible, pero cierra el vector de traer código de otro dominio, que
 * es el que importa acá.
 */
/**
 * A dónde puede hablar el navegador además de a nosotros.
 *
 * El archivo va del navegador a S3 sin pasar por el servidor —esa es la gracia
 * de la URL firmada—, así que el PUT sale contra el host del bucket y la CSP
 * tiene que dejarlo. Sin esto no se sube nada: ni una foto de la vitrina ni el
 * material de una galería. Y tampoco funciona el guardado en iPhone, que baja
 * la foto con `fetch` antes de abrir la hoja de compartir.
 *
 * Sale de las variables del entorno para que apuntar el bucket a otro lado no
 * requiera acordarse de tocar esto también.
 */
const destinosDeSubida = () => {
  const region = process.env.AWS_REGION ?? "us-east-2";
  const bucket = process.env.AWS_S3_BUCKET;
  const cdn = process.env.CLOUDFRONT_DOMAIN?.replace(/^https?:\/\//, "").replace(
    /\/$/,
    "",
  );

  return [
    // Las dos formas en que S3 arma la URL: con el bucket como subdominio y la
    // clásica con el bucket en la ruta.
    bucket ? `https://${bucket}.s3.${region}.amazonaws.com` : null,
    `https://s3.${region}.amazonaws.com`,
    // El CDN sirve la vitrina; el guardado en iOS la vuelve a pedir por fetch.
    cdn ? `https://${cdn}` : null,
  ].filter(Boolean);
};

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // Cloudflare inyecta su beacon de analítica en el sitio que tiene delante.
  // Sin esto la consola se llena de errores de CSP en cada visita. Es
  // infraestructura propia del dominio, no un tercero cualquiera.
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  // Las fotos salen del CDN o de S3 firmado; los blobs, del guardado en iOS.
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  // Mercado Pago se abre por redirección, no por fetch. El beacon de Cloudflare
  // reporta contra el mismo dominio, pero se lo nombra igual por si cambia.
  [
    "connect-src 'self' https://cloudflareinsights.com",
    ...destinosDeSubida(),
  ].join(" "),
  "upgrade-insecure-requests",
].join("; ");

const cabeceras = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

/** @type {import("next").NextConfig} */
const config = {
  // No anunciamos con qué está hecho: es gratis y le quita pistas a quien mira.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: cabeceras }];
  },
};

export default config;
