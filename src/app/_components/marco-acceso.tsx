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
  alCambiarSolapa,
  children,
}: {
  solapa: "registro" | "login";
  /**
   * Si se pasa, las solapas cambian en el lugar (es la página del grupo, que
   * tiene las dos cosas). Si no, llevan a las páginas sueltas.
   */
  alCambiarSolapa?: (solapa: "registro" | "login") => void;
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
            <Solapas solapa={solapa} alCambiar={alCambiarSolapa} />
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
  alCambiar,
}: {
  solapa: "registro" | "login";
  alCambiar?: (solapa: "registro" | "login") => void;
}) {
  const clases = (activa: boolean, primera: boolean) =>
    `flex-1 border border-ink px-4 py-3 text-center font-rotulo text-[13px] uppercase tracking-[0.06em] transition-colors ${
      primera ? "border-r-0" : ""
    } ${activa ? "bg-ink text-paper" : "bg-transparent hover:bg-paper-dim"}`;

  if (alCambiar) {
    return (
      <div className="mb-8 flex">
        <button
          type="button"
          onClick={() => alCambiar("registro")}
          className={clases(solapa === "registro", true)}
        >
          Registrarme
        </button>
        <button
          type="button"
          onClick={() => alCambiar("login")}
          className={clases(solapa === "login", false)}
        >
          Ya tengo cuenta
        </button>
      </div>
    );
  }

  return (
    <div className="mb-8 flex">
      <Link href="/registro" className={clases(solapa === "registro", true)}>
        Registrarme
      </Link>
      <Link href="/entrar" className={clases(solapa === "login", false)}>
        Ya tengo cuenta
      </Link>
    </div>
  );
}
