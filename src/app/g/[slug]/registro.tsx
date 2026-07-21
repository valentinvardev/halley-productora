"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Boton, Campo } from "~/app/_components/ui";
import { fecha, pesos } from "~/lib/format";
import { api } from "~/trpc/react";

export function Registro({
  slug,
  grupo,
}: {
  slug: string;
  grupo: {
    nombre: string;
    colegio: string;
    montoCuota: number;
    venceEl: Date;
    cuotaActual: number;
    cuotasTotales: number;
  };
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");

  const registrarse = api.padre.registrarse.useMutation({
    onSuccess: (r) => router.push(`/p/${r.token}`),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dimmer px-4 py-10">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          registrarse.mutate({ slug, nombre, email, telefono });
        }}
        className="w-full max-w-[400px] border border-ink bg-lienzo px-7 py-8"
      >
        <div className="eyebrow">{grupo.colegio}</div>
        <h1 className="mt-1 text-[21px] leading-snug">{grupo.nombre}</h1>

        <p className="mt-4 text-[13.5px] leading-relaxed text-gray-70">
          Anotate para recibir tu link de pago personal. No necesitás crear
          usuario ni contraseña.
        </p>

        <div className="my-6 border-y border-gray-20 py-4">
          <div className="font-display text-[32px] leading-none">
            {pesos(grupo.montoCuota)}
          </div>
          <div className="mt-1.5 font-mono text-[11px] tracking-[0.04em] text-gray-70">
            VENCE {fecha(grupo.venceEl)} · CUOTA {grupo.cuotaActual} DE{" "}
            {grupo.cuotasTotales}
          </div>
        </div>

        <div className="grid gap-4">
          <Campo
            label="Nombre y apellido"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Fernando Ríos"
            required
          />
          <Campo
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="fernando@mail.com"
            required
          />
          <Campo
            label="Teléfono (opcional)"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+54 9 351..."
          />
        </div>

        {registrarse.error && (
          <p className="mt-3 font-mono text-[11px] text-marca">
            {registrarse.error.message}
          </p>
        )}

        <Boton type="submit" className="mt-6 w-full" disabled={registrarse.isPending}>
          {registrarse.isPending ? "Generando tu link…" : "Quiero mi link de pago"}
        </Boton>
      </form>
    </div>
  );
}
