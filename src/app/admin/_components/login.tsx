"use client";

import { useActionState } from "react";

import { BotonTema } from "~/app/_components/tema";
import { Boton, Campo } from "~/app/_components/ui";
import { iniciarSesion, type EstadoLogin } from "../acciones";

export function Login() {
  const [estado, accion, pendiente] = useActionState<EstadoLogin, FormData>(
    iniciarSesion,
    null,
  );

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form
        action={accion}
        className="w-full max-w-[380px] border border-ink bg-paper p-8"
      >
        <div className="mb-2 flex items-start justify-between gap-4">
          <div className="eyebrow">Halley Producciones — panel</div>
          <BotonTema />
        </div>
        <h1 className="mb-6 text-[26px] leading-tight">Hoja de contacto</h1>

        <Campo
          label="Clave"
          name="clave"
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="••••••••"
        />

        {estado?.error && (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.06em] text-marca">
            {estado.error}
          </p>
        )}

        <Boton type="submit" className="mt-6 w-full" disabled={pendiente}>
          {pendiente ? "Entrando…" : "Entrar"}
        </Boton>
      </form>
    </div>
  );
}
