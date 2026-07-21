import { DetalleGrupo } from "../../_components/detalle-grupo";

export default async function GrupoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DetalleGrupo id={id} />;
}
