"use client";

import Link from "next/link";
import { useActionState } from "react";

import { entrarPadre, type EstadoAcceso } from "~/app/_acciones/sesion";
import { MarcoAcceso } from "~/app/_components/marco-acceso";
import { Boton, Campo } from "~/app/_components/ui";

/**
 * Login suelto, para quien no tiene a mano el link de su grupo. El registro
 * vive en la página del grupo, porque la lista de alumnos es de ese evento.
 */
export function Entrar({ aviso }: { aviso: string | null }) {
  const [estado, accion, entrando] = useActionState<EstadoAcceso, FormData>(
    entrarPadre,
    null,
  );

  // Sólo aparece con AUTH_PADRES=enlace; en la demo se entra derecho.
  if (estado && "enlaceEnviado" in estado) {
    return (
      <MarcoAcceso solapa="login">
        <h1 className="text-[26px] leading-tight">Revisá tu correo</h1>
        <p className="mt-4 text-[13.5px] leading-relaxed text-gray-70">
          Si <strong>{estado.enlaceEnviado}</strong> tiene una cuenta, le
          acabamos de mandar un link para entrar. Vence en 30 minutos.
        </p>
        {estado.url && (
          <div className="mt-6 border border-gray-20 bg-paper-dim p-4">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-gray-45">
              Demo — el mail no sale de verdad
            </div>
            <Link
              href={estado.url.replace(/^https?:\/\/[^/]+/, "")}
              className="mt-2 block font-mono text-[11px] break-all underline underline-offset-2"
            >
              Abrir el link de acceso
            </Link>
          </div>
        )}
      </MarcoAcceso>
    );
  }

  return (
    <MarcoAcceso solapa="login">
      <h1 className="text-[26px] leading-tight">Entrar</h1>

      {aviso && (
        <p className="mt-4 border border-gray-20 bg-paper-dim px-3 py-3 font-mono text-[10.5px] leading-relaxed uppercase tracking-[0.06em] text-gray-70">
          {aviso}
        </p>
      )}

      <p className="mt-3 mb-6 text-[13.5px] leading-relaxed text-gray-70">
        Entrá con el email con el que te registraste. No hay contraseña.
      </p>

      <form action={accion}>
        <Campo
          label="Email"
          type="email"
          name="email"
          placeholder="mama@mail.com"
          autoFocus
          required
        />

        {estado && "error" in estado && (
          <p className="mt-3 font-mono text-[11px] text-marca">{estado.error}</p>
        )}

        <Boton type="submit" className="mt-6 w-full" disabled={entrando}>
          {entrando ? "Entrando…" : "Entrar"}
        </Boton>
      </form>

      <p className="mt-6 font-mono text-[10.5px] leading-relaxed uppercase tracking-[0.06em] text-gray-45">
        ¿Todavía no te registraste? Usá el link que Halley compartió en tu curso.
      </p>
    </MarcoAcceso>
  );
}
