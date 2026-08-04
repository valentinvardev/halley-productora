"use client";

import Link from "next/link";
import { useState } from "react";

import { Ayuda } from "./ayuda";
import { Cajon, itemCajon } from "./cajon";
import { IconoHamburguesa, IconoPerfil } from "./iconos";
import { Logotipo } from "./logotipo";
import { BotonTema } from "./tema";

/**
 * La barra de la landing.
 *
 * No reusa la `Barra` de los paneles a propósito: allá los íconos de la
 * derecha son perfil y navegación de una app con sesión. Acá no hay sesión —
 * hay secciones de una página y un lugar a donde escribir.
 */
export function NavPublica({
  secciones,
}: {
  secciones: { href: string; texto: string }[];
}) {
  const [menu, setMenu] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-20 bg-paper/90 backdrop-blur-md">
        {/* La barra es más alta que la de los paneles porque el isologo es
            vertical: el barrilete necesita aire arriba y abajo. */}
        <div className="mx-auto flex h-20 max-w-[1140px] items-center justify-between gap-4 px-6 sm:px-10">
          <Link href="/" aria-label="Halley Audiovisual">
            <Logotipo variante="isologo" className="h-14" prioridad />
          </Link>

          <div className="flex items-center gap-6">
            <nav className="hidden items-center gap-7 md:flex">
              {secciones.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  className="font-rotulo text-[12.5px] uppercase tracking-[0.1em] text-gray-70 hover:text-ink"
                >
                  {s.texto}
                </a>
              ))}
            </nav>

            {/* El acceso de quien ya es cliente.
                Estaba al pie de la landing, que es donde no lo encuentra el que
                entra a hacer una sola cosa: ver su cuota. Acá está a mano desde
                cualquier punto de la página, y con borde para que se lea como
                una puerta y no como una sección más del menú. */}
            <Link
              href="/entrar"
              className="hidden items-center gap-2 border border-ink px-3.5 py-2 font-rotulo text-[11.5px] uppercase tracking-[0.08em] transition-colors hover:bg-ink hover:text-paper sm:inline-flex"
            >
              <IconoPerfil className="h-3.5 w-3.5" />
              Mi panel
            </Link>

            <Ayuda texto="Claro / oscuro">
              <BotonTema />
            </Ayuda>

            <Ayuda texto="Menú" className="md:hidden">
              <button
                type="button"
                onClick={() => setMenu(true)}
                aria-label="Abrir el menú"
                className="grid cursor-pointer place-items-center text-gray-45 hover:text-ink"
              >
                <IconoHamburguesa className="h-4 w-4" />
              </button>
            </Ayuda>
          </div>
        </div>
      </header>

      <Cajon abierto={menu} alCerrar={() => setMenu(false)} titulo="Secciones">
        {secciones.map((s) => (
          <a
            key={s.href}
            href={s.href}
            onClick={() => setMenu(false)}
            className={itemCajon}
          >
            {s.texto}
          </a>
        ))}
        <Link href="/entrar" onClick={() => setMenu(false)} className={itemCajon}>
          Panel de familias
        </Link>
      </Cajon>
    </>
  );
}
