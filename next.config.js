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
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // Las fotos salen del CDN o de S3 firmado; los blobs, del guardado en iOS.
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  // Mercado Pago se abre por redirección, no por fetch.
  "connect-src 'self'",
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
