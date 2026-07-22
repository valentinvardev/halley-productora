"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { MarcoAcceso } from "~/app/_components/marco-acceso";
import { Boton, Campo } from "~/app/_components/ui";
import { api } from "~/trpc/react";

/**
 * Registro sin link a mano.
 *
 * El registro está atado al grupo: la lista de alumnos no puede ser pública ni
 * navegable, así que acá se pide el link (o el código) que Halley le pasó a la
 * familia, y de ahí se sigue en /g/[slug].
 */
export function BuscarGrupo() {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [slug, setSlug] = useState<string | null>(null);

  // Acepta el link entero o sólo el código: la familia pega lo que tenga.
  const codigo = (slug ?? "").trim();

  const { data, isFetching, error } = api.cuenta.grupoPorSlug.useQuery(
    { slug: codigo },
    { enabled: codigo.length > 0, retry: false },
  );

  // Si el grupo existe, seguimos al registro; si no, se muestra el error.
  useEffect(() => {
    if (data && codigo) router.push(`/g/${codigo}`);
  }, [data, codigo, router]);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = texto
      .trim()
      .replace(/^https?:\/\/[^/]+\/g\//, "")
      .replace(/^\/?g\//, "")
      .replace(/\/+$/, "");
    setSlug(limpio);
  }

  return (
    <MarcoAcceso solapa="registro">
      <h1 className="text-[26px] leading-tight">Registrate</h1>
      <p className="mt-3 mb-6 text-[13.5px] leading-relaxed text-gray-70">
        Necesitás el link que Halley le pasó a tu curso. Pegalo acá y te
        llevamos a la lista de tu grupo.
      </p>

      <form onSubmit={buscar}>
        <Campo
          label="Link o código del grupo"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="egresados-2027-colegio-san-martin"
          autoFocus
          required
        />

        {error && (
          <p className="mt-3 nota text-marca">
            No encontramos ese grupo. Revisá el link o pedíselo a Halley.
          </p>
        )}

        <Boton
          type="submit"
          className="mt-6 w-full"
          disabled={!texto || isFetching}
        >
          {isFetching ? "Buscando…" : "Continuar"}
        </Boton>
      </form>
    </MarcoAcceso>
  );
}
