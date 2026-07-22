"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  entrarPadre,
  registrarResponsable,
  type EstadoAcceso,
} from "~/app/_acciones/sesion";
import { Desplegable } from "~/app/_components/desplegable";
import { MarcoAcceso } from "~/app/_components/marco-acceso";
import { Boton, Campo } from "~/app/_components/ui";
import { fecha, pesos } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * La pantalla del grupo: es a la vez el registro y el login de ese evento.
 * El link se comparte dentro del curso, así que la lista de alumnos vive acá.
 */
export function Registro({
  slug,
  alumnoInicial,
}: {
  slug: string;
  /** Viene del link que manda Halley: llega con su hijo ya elegido. */
  alumnoInicial?: string | null;
}) {
  const { data: grupo } = api.cuenta.grupoPorSlug.useQuery({ slug });
  const [solapa, setSolapa] = useState<"registro" | "login">("registro");
  const [alumnoId, setAlumnoId] = useState<string | null>(alumnoInicial ?? null);

  const [estadoRegistro, accionRegistro, registrando] = useActionState<
    EstadoAcceso,
    FormData
  >(registrarResponsable, null);

  const [estadoLogin, accionLogin, entrando] = useActionState<
    EstadoAcceso,
    FormData
  >(entrarPadre, null);

  if (!grupo) {
    return (
      <MarcoAcceso solapa={solapa} alCambiarSolapa={setSolapa}>
        <p className="font-rotulo text-[12px] uppercase tracking-[0.08em] text-gray-45">
          Cargando…
        </p>
      </MarcoAcceso>
    );
  }

  const estado = solapa === "registro" ? estadoRegistro : estadoLogin;

  // Sólo aparece con AUTH_PADRES=enlace; en la demo se entra derecho.
  if (estado && "enlaceEnviado" in estado) {
    return (
      <MarcoAcceso solapa={solapa} alCambiarSolapa={setSolapa}>
        <h1 className="text-[26px] leading-tight">Revisá tu correo</h1>
        <p className="mt-4 text-[13.5px] leading-relaxed text-gray-70">
          Le mandamos un link a <strong>{estado.enlaceEnviado}</strong> para
          entrar. Vence en 30 minutos y sirve una sola vez.
        </p>
        {estado.url && (
          <div className="mt-6 border border-gray-20 bg-paper-dim p-4">
            <div className="font-rotulo text-[10.5px] uppercase tracking-[0.1em] text-gray-45">
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
    <MarcoAcceso solapa={solapa} alCambiarSolapa={setSolapa}>
      <div className="eyebrow">{grupo.colegio}</div>
      <h1 className="mt-1 text-[26px] leading-tight">{grupo.nombre}</h1>

      {/* La key hace que React remonte al cambiar de solapa, y con eso la
          animación de entrada vuelve a correr. */}
      <div key={solapa} className={`solapa-${solapa}`}>
      {solapa === "registro" ? (
        <>
          <p className="mt-4 text-[13.5px] leading-relaxed text-gray-70">
            Elegí a tu hijo o hija y dejá tu email. Con eso entrás: no hay
            contraseña. Pueden registrarse hasta {grupo.maxResponsables}{" "}
            responsables por alumno.
          </p>

          {grupo.primerVencimiento && (
            <div className="my-6 border-y border-gray-20 py-4">
              <div className="font-display text-[30px] leading-none">
                {pesos(grupo.montoCuota)}
              </div>
              <div className="mt-1.5 font-rotulo text-[12px] tracking-[0.05em] text-gray-70">
                {grupo.cuotas} CUOTAS · LA PRIMERA VENCE{" "}
                {fecha(grupo.primerVencimiento)}
              </div>
            </div>
          )}

          <form action={accionRegistro} className="grid gap-4">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="alumnoId" value={alumnoId ?? ""} />

            <Desplegable
              label="¿Quién es tu hijo o hija?"
              opciones={grupo.alumnos.map((a) => ({
                valor: a.id,
                etiqueta: a.nombre,
                nota: a.completo
                  ? "sin lugar"
                  : a.responsables > 0
                    ? `${a.responsables} de ${grupo.maxResponsables}`
                    : undefined,
                deshabilitada: a.completo,
              }))}
              valor={alumnoId}
              alCambiar={setAlumnoId}
              placeholder="Elegí de la lista"
              vacio="Todavía no hay alumnos cargados"
            />

            <Campo
              label="Tu email"
              type="email"
              name="email"
              placeholder="mama@mail.com"
              required
            />

            {estado && "error" in estado && (
              <p className="nota text-marca">
                {estado.error}
              </p>
            )}

            {/* Sin hijo elegido no hay nada que registrar. */}
            <Boton type="submit" className="w-full" disabled={!alumnoId || registrando}>
              {registrando ? "Entrando…" : "Registrarme"}
            </Boton>
          </form>
        </>
      ) : (
        <>
          <p className="mt-4 mb-6 text-[13.5px] leading-relaxed text-gray-70">
            Entrá con el email con el que te registraste.
          </p>

          <form action={accionLogin} className="grid gap-4">
            <Campo
              label="Tu email"
              type="email"
              name="email"
              placeholder="mama@mail.com"
              autoFocus
              required
            />

            {estado && "error" in estado && (
              <p className="nota text-marca">
                {estado.error}
              </p>
            )}

            <Boton type="submit" className="w-full" disabled={entrando}>
              {entrando ? "Entrando…" : "Entrar"}
            </Boton>
          </form>
        </>
      )}
      </div>
    </MarcoAcceso>
  );
}
