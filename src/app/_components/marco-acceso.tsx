"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Muestra } from "./muestra";
import { BotonTema } from "./tema";

/**
 * Marco de las pantallas de acceso: a la izquierda el formulario, a la derecha
 * la muestra de trabajos. En pantallas chicas la muestra desaparece — no hay
 * lugar y el formulario es lo único que hace falta.
 */
export function MarcoAcceso({
  solapa,
  slug,
  children,
}: {
  /** Cuál de las dos solapas está activa. */
  solapa: "registro" | "login";
  /** Grupo al que pertenece el registro; sin esto la solapa lleva a /entrar. */
  slug?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col lg:w-[46%] xl:w-[42%]">
        <header className="flex items-center justify-between px-8 py-6">
          <Link href="/" className="font-display text-[15px] font-semibold">
            Halley Producciones
          </Link>
          <BotonTema />
        </header>

        <main className="flex flex-1 items-center justify-center px-8 pb-12">
          <div className="w-full max-w-[400px]">
            <Solapas solapa={solapa} slug={slug} />
            {children}
          </div>
        </main>

        <footer className="px-8 py-6">
          <p className="font-mono text-[10px] tracking-[0.1em] text-gray-45">
            HALLEY × SURCODIA — 026
          </p>
        </footer>
      </div>

      {/* La muestra: decorativa, se oculta en mobile. */}
      <div
        className="hidden border-l border-ink lg:block lg:flex-1"
        aria-hidden="true"
      >
        <Muestra />
      </div>
    </div>
  );
}

function Solapas({
  solapa,
  slug,
}: {
  solapa: "registro" | "login";
  slug?: string;
}) {
  const clases = (activa: boolean) =>
    `flex-1 border border-ink px-4 py-3 text-center font-mono text-[11px] uppercase tracking-[0.06em] transition-colors ${
      activa ? "bg-ink text-paper" : "bg-transparent hover:bg-paper-dim"
    }`;

  return (
    <div className="mb-8 flex">
      <Link
        href={slug ? `/g/${slug}` : "/registro"}
        className={`${clases(solapa === "registro")} border-r-0`}
      >
        Registrarme
      </Link>
      <Link href="/entrar" className={clases(solapa === "login")}>
        Iniciar sesión
      </Link>
    </div>
  );
}
