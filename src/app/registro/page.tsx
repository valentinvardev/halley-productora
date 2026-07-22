import type { Metadata } from "next";

import { BuscarGrupo } from "./buscar-grupo";

export const metadata: Metadata = {
  title: "Registrate — Halley Producciones",
};

export default function RegistroPage() {
  return <BuscarGrupo />;
}
