"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

import { Logotipo } from "./logotipo";
import { BotonTema } from "./tema";

/**
 * La navegación del panel en escritorio: una columna fija a la izquierda.
 *
 * Convive con la barra de arriba, que en pantalla chica sigue llevando la
 * hamburguesa y el perfil. Acá esos mismos destinos están siempre a la vista,
 * que es lo que gana el escritorio: no hay que abrir nada para cambiar de
 * sección.
 *
 * El destino activo se resalta comparando contra la ruta actual — la más larga
 * que sea prefijo del pathname, para que `/admin/contenidos` no encienda
 * también a `/admin`.
 */
export function SidebarPanel({
  href,
  enlaces,
  identidad,
  salir,
}: {
  href: string;
  enlaces: { href: string; texto: string; icono: ReactNode }[];
  identidad: { titulo: string; detalle?: string };
  salir: ReactNode;
}) {
  const pathname = usePathname();

  // El activo es el enlace cuyo href es el prefijo más largo del pathname.
  const activo = enlaces
    .filter((e) => pathname === e.href || pathname.startsWith(`${e.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-gray-20 bg-paper lg:flex">
      <div className="border-b border-gray-20 px-6 py-6">
        <Link href={href} aria-label="Halley Audiovisual">
          <Logotipo variante="palabra" className="h-6" prioridad />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {enlaces.map((e) => {
          const esActivo = e.href === activo;
          return (
            <Link
              key={e.href}
              href={e.href}
              aria-current={esActivo ? "page" : undefined}
              className={`mb-1 flex items-center gap-3 border px-3 py-2.5 font-rotulo text-[13px] uppercase tracking-[0.06em] transition-colors ${
                esActivo
                  ? "border-ink bg-ink text-paper"
                  : "border-transparent text-gray-70 hover:border-gray-20 hover:text-ink"
              }`}
            >
              <span className="shrink-0">{e.icono}</span>
              {e.texto}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-20 px-5 py-4">
        <div className="mb-3">
          <div className="text-[13px]">{identidad.titulo}</div>
          {identidad.detalle && (
            <div className="mt-0.5 font-mono text-[10.5px] break-all text-gray-45">
              {identidad.detalle}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          {salir}
          <BotonTema />
        </div>
      </div>
    </aside>
  );
}
