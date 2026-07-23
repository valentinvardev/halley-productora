import { Linea } from "~/app/_components/esqueleto";
import { EsqueletoGaleria } from "../../_components/esqueletos";

export default function Cargando() {
  return (
    <>
      <Linea className="mb-6 h-3 w-28" />
      <Linea className="h-8 w-48" />
      <Linea className="mt-3 mb-8 h-3 w-64" />
      <EsqueletoGaleria />
    </>
  );
}
