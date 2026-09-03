import type { Metadata } from "next";

import { FUENTES_MARCA } from "~/app/_components/fuentes";
import { Logotipo } from "~/app/_components/logotipo";
import { abrirValoracion } from "~/server/valoraciones";

import { FormularioValoracion } from "./formulario";

export const metadata: Metadata = {
  title: "Tu valoración — Halley Audiovisual",
};

export const dynamic = "force-dynamic";

const MOTIVOS = {
  invalido: "Este link no es válido.",
  usado: "Este link ya se usó. Gracias por tu valoración.",
  vencido:
    "Este link ya venció. Si querés dejarnos tu valoración, escribinos y te mandamos otro.",
} as const;

/**
 * La página del link de valoración.
 *
 * Se abre desde el mail, sin sesión: el link es la llave. Si el link no
 * sirve, dice por qué y nada más; no hay a dónde mandar a la persona.
 */
export default async function ValorarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const abierta = await abrirValoracion(token);

  return (
    <div className={`landing min-h-screen ${FUENTES_MARCA}`}>
      <div className="mx-auto max-w-[640px] px-6 py-14 sm:px-10 sm:py-20">
        <Logotipo variante="isologo" className="h-16" prioridad />

        {abierta.ok ? (
          <>
            <p className="mt-12 font-rotulo text-[12.5px] uppercase tracking-[0.22em] text-gray-70">
              {abierta.grupo}
            </p>
            <h1 className="mt-4 font-titulo text-[clamp(2rem,6vw,3.6rem)] leading-[0.92] uppercase">
              ¿Cómo la pasaron?
            </h1>
            <p className="mt-6 max-w-[52ch] text-[15.5px] leading-relaxed text-gray-70">
              Contanos en unas líneas cómo fue el evento de {abierta.alumno}. Lo
              que escribas puede salir en nuestra web, con tu nombre y, si
              querés, tu foto.
            </p>
            <FormularioValoracion token={token} />
          </>
        ) : (
          <>
            <h1 className="mt-12 font-titulo text-[clamp(2rem,6vw,3.6rem)] leading-[0.92] uppercase">
              Este link no anda
            </h1>
            <p className="mt-6 max-w-[52ch] text-[15.5px] leading-relaxed text-gray-70">
              {MOTIVOS[abierta.motivo]}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
