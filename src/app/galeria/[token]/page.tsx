import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { GaleriaEntrega } from "~/app/_components/galeria-entrega";
import {
  cookieDesbloqueo,
  fotosDeGaleriaNativa,
  galeriaNativaPorToken,
  galeriaVigente,
  pruebaDesbloqueo,
} from "~/server/galerias";
import { PantallaPassword } from "./pantalla-password";

export const metadata: Metadata = {
  title: "Galería — Halley Producciones",
  robots: { index: false },
};

/**
 * La galería nativa vista por quien recibe el link.
 *
 * Tres puertas antes del visor: que exista, que no haya vencido, y —si tiene
 * contraseña— que esté desbloqueada. La cookie de desbloqueo se compara contra
 * la prueba derivada del hash, la misma que revalida la ruta que sirve cada
 * foto: la pantalla no es el control, es sólo la puerta.
 */
export default async function GaleriaNativaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const galeria = await galeriaNativaPorToken(token);
  if (!galeria) notFound();

  if (!galeriaVigente(galeria)) {
    return (
      <Marco>
        <div className="eyebrow mb-2">Galería</div>
        <h1 className="text-[24px] leading-tight">{galeria.titulo}</h1>
        <p className="nota mt-4 border border-dashed border-gray-20 bg-paper-dim px-4 py-4">
          Este enlace venció y ya no está disponible. Si necesitás el material,
          escribile a quien te lo compartió.
        </p>
      </Marco>
    );
  }

  const galleta = await cookies();
  const desbloqueada =
    !galeria.passwordHash ||
    galleta.get(cookieDesbloqueo(galeria.id))?.value ===
      pruebaDesbloqueo(galeria);

  if (!desbloqueada) {
    return <PantallaPassword token={token} titulo={galeria.titulo} />;
  }

  const fotos = await fotosDeGaleriaNativa(galeria);

  return (
    <Marco>
      <div className="eyebrow mb-2">Galería</div>
      <h1 className="mb-8 text-[26px] leading-tight">{galeria.titulo}</h1>
      {fotos.length > 0 ? (
        <GaleriaEntrega titulo="" fotos={fotos} />
      ) : (
        <p className="nota border border-dashed border-gray-20 bg-paper-dim px-4 py-4">
          Todavía no hay fotos cargadas en esta galería.
        </p>
      )}
    </Marco>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper-dimmer px-5 py-10">
      <div className="mx-auto max-w-[1100px]">{children}</div>
    </div>
  );
}
