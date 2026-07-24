import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    /** Clave del panel de administración. Una sola cuenta, sin usuarios. */
    ADMIN_PASSWORD: z.string().min(1).default("halley"),
    /** Casilla de Halley que recibe el aviso de cada pago. */
    ADMIN_EMAIL: z.string().email().default("admin@halleyproducciones.com"),

    /**
     * "mock" genera CVU/alias localmente y habilita el simulador de
     * transferencias. "real" apunta a la Customers API de Talo.
     */
    TALO_MODE: z.enum(["mock", "real"]).default("mock"),
    TALO_API_URL: z.string().url().optional(),
    TALO_API_KEY: z.string().optional(),

    /**
     * "mock" simula el ida y vuelta de Checkout Pro con una pantalla demo, sin
     * plata real. "real" crea preferencias contra la API de Mercado Pago con el
     * token de cada socio (guardado en su CuentaPago). El token NO va acá: es
     * por cuenta, no global.
     */
    MP_MODE: z.enum(["mock", "real"]).default("mock"),

    /**
     * "bandeja" registra los emails sin enviarlos (modo demo).
     * "resend" además los manda de verdad — requiere RESEND_API_KEY.
     * En los dos casos quedan guardados y visibles en el panel.
     */
    /**
     * Cómo entran las familias.
     * "directo" — con el email alcanza: entra en el momento. Es lo que se usa
     *   en la demo, donde parar a revisar un correo rompe el recorrido.
     * "enlace" — se manda un link de un solo uso al email y se canjea. Es lo
     *   que corresponde en producción: sin esto, saber el email de otro
     *   alcanza para entrar a su cuenta.
     */
    AUTH_PADRES: z.enum(["directo", "enlace"]).default("directo"),

    EMAIL_MODE: z.enum(["bandeja", "resend"]).default("bandeja"),
    RESEND_API_KEY: z.string().optional(),
    /** Remitente verificado en Resend. */
    EMAIL_FROM: z.string().default("Halley Producciones <onboarding@resend.dev>"),
    /**
     * A dónde van las respuestas cuando una familia contesta un aviso.
     *
     * El remitente suele ser una dirección del dominio verificado en Resend que
     * no tiene casilla: si alguien responde ahí, la respuesta se pierde. Esta
     * variable manda las respuestas a un buzón que Halley sí lee. Si no se
     * define, se usa ADMIN_EMAIL, que ya es la casilla que recibe los avisos.
     */
    EMAIL_REPLY_TO: z.string().email().optional(),

    /**
     * AWS S3 — donde vive el contenido de la vitrina.
     *
     * Todas opcionales: sin ellas la subida se apaga sola y la landing sigue
     * mostrando las imágenes de relleno. AWS_S3_PREFIX es la carpeta de este
     * cliente dentro del bucket — cambiarla aísla las fotos de Halley de las de
     * cualquier otro proyecto que comparta el mismo bucket.
     */
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().default("us-east-2"),
    AWS_S3_BUCKET: z.string().optional(),
    AWS_S3_PREFIX: z.string().optional(),
    /**
     * Dominio de CloudFront delante del bucket. Si está, el contenido se sirve
     * por el CDN —cacheado en el borde y con egress más barato— en vez de
     * salir de S3 directo. Sin esto, se cae a URLs firmadas de S3.
     */
    CLOUDFRONT_DOMAIN: z.string().optional(),
    /** Reservado para invalidar la caché del CDN; hoy no se usa. */
    CLOUDFRONT_DISTRIBUTION_ID: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    /** Base para armar los links personales de cada padre. */
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    NODE_ENV: process.env.NODE_ENV,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    TALO_MODE: process.env.TALO_MODE,
    TALO_API_URL: process.env.TALO_API_URL,
    TALO_API_KEY: process.env.TALO_API_KEY,
    MP_MODE: process.env.MP_MODE,
    AUTH_PADRES: process.env.AUTH_PADRES,
    EMAIL_MODE: process.env.EMAIL_MODE,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    AWS_S3_PREFIX: process.env.AWS_S3_PREFIX,
    CLOUDFRONT_DOMAIN: process.env.CLOUDFRONT_DOMAIN,
    CLOUDFRONT_DISTRIBUTION_ID: process.env.CLOUDFRONT_DISTRIBUTION_ID,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
