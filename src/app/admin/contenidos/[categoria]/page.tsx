import { notFound } from "next/navigation";

import { CATEGORIAS, esCategoria } from "~/app/_datos/categorias";
import { GaleriaCategoria } from "../../_components/galeria-categoria";

export default async function GaleriaPage({
  params,
}: {
  params: Promise<{ categoria: string }>;
}) {
  const { categoria } = await params;
  if (!esCategoria(categoria)) notFound();

  const nombre = CATEGORIAS.find((c) => c.slug === categoria)!.nombre;
  return <GaleriaCategoria slug={categoria} nombre={nombre} />;
}
