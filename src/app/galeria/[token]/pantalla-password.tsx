"use client";

import { useActionState } from "react";

import { Boton, Campo } from "~/app/_components/ui";
import { desbloquearGaleria, type EstadoDesbloqueo } from "./acciones";

/**
 * La puerta de una galería nativa con contraseña. Manda la contraseña a la
 * acción del servidor, que la verifica y —si acierta— deja la cookie y vuelve a
 * la galería ya abierta.
 */
export function PantallaPassword({
  token,
  titulo,
}: {
  token: string;
  titulo: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoDesbloqueo, FormData>(
    desbloquearGaleria.bind(null, token),
    null,
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dimmer px-6">
      <form
        action={accion}
        className="w-full max-w-[380px] border border-ink bg-lienzo p-8"
      >
        <div className="eyebrow mb-2">Galería protegida</div>
        <h1 className="mb-1 text-[24px] leading-tight">{titulo}</h1>
        <p className="nota mb-6">
          Pedile la contraseña a quien te compartió esta galería.
        </p>

        <Campo
          label="Contraseña"
          name="password"
          type="password"
          autoFocus
          autoComplete="off"
          placeholder="••••••••"
        />

        {estado?.error && <p className="nota mt-3 text-marca">{estado.error}</p>}

        <Boton type="submit" className="mt-6 w-full" disabled={pendiente}>
          {pendiente ? "Abriendo…" : "Entrar"}
        </Boton>
      </form>
    </div>
  );
}
