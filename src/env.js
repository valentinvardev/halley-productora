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
     * "bandeja" registra los emails sin enviarlos (modo demo).
     * "resend" además los manda de verdad — requiere RESEND_API_KEY.
     * En los dos casos quedan guardados y visibles en el panel.
     */
    EMAIL_MODE: z.enum(["bandeja", "resend"]).default("bandeja"),
    RESEND_API_KEY: z.string().optional(),
    /** Remitente verificado en Resend. */
    EMAIL_FROM: z.string().default("Halley Producciones <onboarding@resend.dev>"),
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
    EMAIL_MODE: process.env.EMAIL_MODE,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
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
