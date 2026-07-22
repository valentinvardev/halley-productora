"use client";

import Link from "next/link";
import { useState } from "react";

import { Desplegable } from "~/app/_components/desplegable";
import { Boton, Campo } from "~/app/_components/ui";
import { fecha, pesos } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * Registro de la familia: elige a su hijo de la lista del grupo y deja su
 * email. No hay contraseña — le llega un link para entrar.
 */
export function Registro({ slug }: { slug: string }) {
  const { data: grupo } = api.cuenta.grupoPorSlug.useQuery({ slug });

  const [alumnoId, setAlumnoId] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const registrarse = api.cuenta.registrarse.useMutation();

  if (!grupo) {
    return (
      <div className="flex min-h-screen items-center justify-center font-mono text-[11px] uppercase tracking-[0.08em] text-gray-45">
        Cargando…
      </div>
    );
  }

  /* ------------------------------------------------------ link ya enviado */
  if (registrarse.isSuccess) {
    return (
      <Marco>
        <div className="eyebrow">{grupo.colegio}</div>
        <h1 className="mt-1 text-[21px] leading-snug">Revisá tu correo</h1>
        <p className="mt-4 text-[13.5px] leading-relaxed text-gray-70">
          Le mandamos un link a <strong>{registrarse.data.email}</strong> para
          entrar. Vence en 30 minutos y sirve una sola vez.
        </p>

        {registrarse.data.url && (
          <div className="mt-6 border border-gray-20 bg-paper p-4">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-gray-45">
              Demo — el mail no sale de verdad
            </div>
            <Link
              href={registrarse.data.url.replace(/^https?:\/\/[^/]+/, "")}
              className="mt-2 block font-mono text-[11px] break-all underline underline-offset-2"
            >
              Abrir el link de acceso
            </Link>
          </div>
        )}
      </Marco>
    );
  }

  /* ------------------------------------------------------------ registro */
  const opciones = grupo.alumnos.map((a) => ({
    valor: a.id,
    etiqueta: a.nombre,
    nota: a.tomado ? "ya registrado" : undefined,
    deshabilitada: a.tomado,
  }));

  return (
    <Marco>
      <div className="eyebrow">{grupo.colegio}</div>
      <h1 className="mt-1 text-[21px] leading-snug">{grupo.nombre}</h1>

      <p className="mt-4 text-[13.5px] leading-relaxed text-gray-70">
        Registrate para seguir los pagos y ver la galería. Sin contraseña: te
        mandamos un link por correo.
      </p>

      {grupo.primerVencimiento && (
        <div className="my-6 border-y border-gray-20 py-4">
          <div className="font-display text-[30px] leading-none">
            {pesos(grupo.montoCuota)}
          </div>
          <div className="mt-1.5 font-mono text-[11px] tracking-[0.04em] text-gray-70">
            {grupo.cuotas} CUOTAS · LA PRIMERA VENCE{" "}
            {fecha(grupo.primerVencimiento)}
          </div>
        </div>
      )}

      <div className="grid gap-4">
        <Desplegable
          label="¿Quién es tu hijo o hija?"
          opciones={opciones}
          valor={alumnoId}
          alCambiar={setAlumnoId}
          placeholder="Elegí de la lista"
          vacio="Todavía no hay alumnos cargados"
        />
        <Campo
          label="Tu email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="mama@mail.com"
          required
        />
      </div>

      {registrarse.error && (
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-marca">
          {registrarse.error.message}
        </p>
      )}

      <Boton
        className="mt-6 w-full"
        // Sin hijo elegido no hay nada que registrar.
        disabled={!alumnoId || !email || registrarse.isPending}
        onClick={() => alumnoId && registrarse.mutate({ slug, alumnoId, email })}
      >
        {registrarse.isPending ? "Enviando el link…" : "Registrarme"}
      </Boton>

      <p className="mt-5 text-center font-mono text-[10.5px] uppercase tracking-[0.06em] text-gray-45">
        ¿Ya te registraste?{" "}
        <Link href="/entrar" className="underline underline-offset-2 hover:text-ink">
          Entrar
        </Link>
      </p>
    </Marco>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dimmer px-4 py-10">
      <div className="w-full max-w-[400px] border border-ink bg-lienzo px-7 py-8">
        {children}
      </div>
    </div>
  );
}
