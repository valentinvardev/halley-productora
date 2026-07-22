"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { Cajon, itemCajon } from "./cajon";
import { IconoHamburguesa, IconoPerfil } from "./iconos";
import { Logotipo } from "./logotipo";
import { Popover } from "./popover";
import { BotonTema } from "./tema";

/**
 * La barra de arriba, compartida por el panel de admin y el de las familias.
 *
 * En pantalla ancha los enlaces van a la vista. En el teléfono no entran, así
 * que se guardan en el cajón lateral y queda sólo la terna de la derecha:
 * tema, perfil y hamburguesa.
 *
 * Son dos cajones y no uno con dos botones: la hamburguesa es *a dónde ir* y el
 * perfil es *con quién estás*. Mezclarlos obliga a leer todo el menú para
 * encontrar "salir".
 */
export function Barra({
  href = "/",
  enlaces = [],
  identidad,
  salir,
  ancho = "max-w-[1080px]",
}: {
  href?: string;
  enlaces?: { href: string; texto: string }[];
  /** Quién está adentro: encabeza el cajón del perfil. */
  identidad: { titulo: string; detalle?: string };
  /** El formulario de salida — es una acción de servidor, la arma cada panel. */
  salir: ReactNode;
  ancho?: string;
}) {
  const [menu, setMenu] = useState(false);
  const [perfil, setPerfil] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-gray-20 bg-paper/95 backdrop-blur-sm">
        <div
          className={`mx-auto flex h-14 ${ancho} items-center justify-between gap-4 px-6 sm:px-8`}
        >
          <Link href={href} aria-label="Halley Audiovisual">
            <Logotipo variante="palabra" className="h-[18px]" prioridad />
          </Link>

          <div className="flex items-center gap-5">
            {enlaces.length > 0 && (
              <nav className="hidden items-center gap-6 sm:flex">
                {enlaces.map((e) => (
                  <Link
                    key={e.href}
                    href={e.href}
                    className="font-rotulo text-[12px] uppercase tracking-[0.06em] text-gray-70 hover:text-ink"
                  >
                    {e.texto}
                  </Link>
                ))}
              </nav>
            )}

            <BotonTema />

            {/* La cuenta baja acá mismo: son dos datos y una acción, no hace
                falta tomar la pantalla entera para eso. */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setPerfil((v) => !v)}
                aria-label="Mi cuenta"
                aria-expanded={perfil}
                className={`grid cursor-pointer place-items-center hover:text-ink ${
                  perfil ? "text-ink" : "text-gray-45"
                }`}
              >
                <IconoPerfil className="h-[15px] w-[15px]" />
              </button>

              <Popover abierto={perfil} alCerrar={() => setPerfil(false)}>
                <div className="border-b border-gray-20 pb-3">
                  <div className="text-[13.5px]">{identidad.titulo}</div>
                  {identidad.detalle && (
                    <div className="mt-1 font-mono text-[11px] break-all text-gray-45">
                      {identidad.detalle}
                    </div>
                  )}
                </div>
                <div className="mt-1">{salir}</div>
              </Popover>
            </div>

            {enlaces.length > 0 && (
              <button
                type="button"
                onClick={() => setMenu(true)}
                aria-label="Abrir el menú"
                className="grid cursor-pointer place-items-center text-gray-45 hover:text-ink sm:hidden"
              >
                <IconoHamburguesa className="h-[15px] w-[15px]" />
              </button>
            )}
          </div>
        </div>
      </header>

      <Cajon abierto={menu} alCerrar={() => setMenu(false)} titulo="Ir a">
        {enlaces.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            onClick={() => setMenu(false)}
            className={itemCajon}
          >
            {e.texto}
          </Link>
        ))}
      </Cajon>

    </>
  );
}
