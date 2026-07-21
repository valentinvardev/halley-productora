"use client";

import { useState } from "react";
import { BotonTexto } from "./ui";

/** Copia un valor al portapapeles y confirma en el mismo botón. */
export function Copiar({
  valor,
  etiqueta = "Copiar",
  className = "",
}: {
  valor: string;
  etiqueta?: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
    } catch {
      // Sin permiso de portapapeles (http, iframe): fallback al viejo execCommand.
      const ta = document.createElement("textarea");
      ta.value = valor;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  }

  return (
    <BotonTexto onClick={copiar} className={className}>
      {copiado ? "Copiado ✓" : etiqueta}
    </BotonTexto>
  );
}
