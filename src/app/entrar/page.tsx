import type { Metadata } from "next";

import { Entrar } from "./entrar";

export const metadata: Metadata = {
  title: "Entrar — Halley Producciones",
};

const MOTIVOS: Record<string, string> = {
  invalido: "Ese link no es válido.",
  vencido: "Ese link ya venció.",
  usado: "Ese link ya se usó.",
};

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;

  return (
    <Entrar
      aviso={
        motivo && MOTIVOS[motivo]
          ? `${MOTIVOS[motivo]} Los links duran 30 minutos y sirven una sola vez. Pedí uno nuevo.`
          : null
      }
    />
  );
}
