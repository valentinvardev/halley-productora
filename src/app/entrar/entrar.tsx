"use client";

import Link from "next/link";
import { useState } from "react";

import { BotonTema } from "~/app/_components/tema";
import { Boton, Campo } from "~/app/_components/ui";
import { api } from "~/trpc/react";

/** Login de padres: sólo el email, y le llega el link para entrar. */
export function Entrar({ aviso }: { aviso: string | null }) {
  const [email, setEmail] = useState("");
  const entrar = api.cuenta.entrar.useMutation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dimmer px-4 py-10">
      <div className="w-full max-w-[380px] border border-ink bg-lienzo px-7 py-8">
        <div className="mb-2 flex items-start justify-between gap-4">
          <div className="eyebrow">Halley Producciones</div>
          <BotonTema />
        </div>

        {entrar.isSuccess ? (
          <>
            <h1 className="text-[22px] leading-tight">Revisá tu correo</h1>
            <p className="mt-4 text-[13.5px] leading-relaxed text-gray-70">
              Si <strong>{entrar.data.email}</strong> tiene una cuenta, le
              acabamos de mandar un link para entrar. Vence en 30 minutos.
            </p>

            {entrar.data.url && (
              <div className="mt-6 border border-gray-20 bg-paper p-4">
                <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-gray-45">
                  Demo — el mail no sale de verdad
                </div>
                <Link
                  href={entrar.data.url.replace(/^https?:\/\/[^/]+/, "")}
                  className="mt-2 block font-mono text-[11px] break-all underline underline-offset-2"
                >
                  Abrir el link de acceso
                </Link>
              </div>
            )}

            <button
              onClick={() => entrar.reset()}
              className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.06em] text-gray-45 underline underline-offset-2 hover:text-ink"
            >
              Usar otro email
            </button>
          </>
        ) : (
          <>
            <h1 className="text-[22px] leading-tight">Entrar</h1>

            {aviso && (
              <p className="mt-4 border border-gray-20 bg-paper px-3 py-3 font-mono text-[10.5px] leading-relaxed uppercase tracking-[0.06em] text-gray-70">
                {aviso}
              </p>
            )}

            <p className="mt-3 mb-6 text-[13.5px] leading-relaxed text-gray-70">
              Poné tu email y te mandamos un link. No hay contraseña.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                entrar.mutate({ email });
              }}
            >
              <Campo
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mama@mail.com"
                autoFocus
                required
              />

              {entrar.error && (
                <p className="mt-3 font-mono text-[11px] text-marca">
                  {entrar.error.message}
                </p>
              )}

              <Boton
                type="submit"
                className="mt-6 w-full"
                disabled={!email || entrar.isPending}
              >
                {entrar.isPending ? "Enviando…" : "Mandame el link"}
              </Boton>
            </form>

            <p className="mt-5 text-center font-mono text-[10.5px] leading-relaxed uppercase tracking-[0.06em] text-gray-45">
              ¿Todavía no te registraste? Usá el link que te pasó Halley.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
