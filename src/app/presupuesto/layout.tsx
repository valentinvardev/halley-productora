import Link from "next/link";
import { type ReactNode } from "react";

import { FUENTES_MARCA } from "~/app/_components/fuentes";
import { Logotipo } from "~/app/_components/logotipo";
import { NavPublica } from "~/app/_components/nav-publica";

/**
 * El marco del simulador.
 *
 * Lleva la clase `landing`, que es la que pisa los tokens de color con los de
 * la marca: sin eso el simulador saldría con la paleta del panel, que es la del
 * producto interno y no la de la web.
 *
 * La navegación es la misma de la web pública, con los destinos apuntando a la
 * portada: el simulador es una página más del sitio, no una isla. Lo único que
 * se saca es el índice de secciones propio, que acá no tiene a qué apuntar.
 */
export default function LayoutPresupuesto({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className={`landing ${FUENTES_MARCA}`}>
      <NavPublica
        secciones={[
          { href: "/#servicios", texto: "Servicios" },
          { href: "/#como", texto: "Cómo trabajamos" },
          { href: "/#contacto", texto: "Contacto" },
        ]}
      />

      {children}

      {/* El pie va reducido a propósito: en un formulario largo, un pie con
          links es una salida más ofrecida justo cuando falta poco. */}
      <footer className="no-imprimir mx-auto max-w-[1140px] px-6 py-10 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Link href="/" aria-label="Halley Audiovisual">
            <Logotipo variante="isologo" className="h-16" />
          </Link>
          <p className="font-rotulo text-[11px] tracking-[0.14em] text-gray-45 uppercase">
            Halley Audiovisual · Córdoba
          </p>
        </div>
      </footer>
    </div>
  );
}
