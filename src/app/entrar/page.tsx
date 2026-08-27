import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { COOKIE_SESION, cuentaDeSesion } from "~/server/cuentas";

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

  /**
   * Al que ya entró no se le vuelve a pedir el mail.
   *
   * Ésta era la queja de "me manda al correo cada vez". La sesión dura un año y
   * se renueva sola, pero esta página no la miraba: quien llegaba con la sesión
   * viva —por el link de "Entrar" del sitio, por un favorito, por un mail
   * viejo— igual veía el formulario, escribía su dirección y recibía otro link.
   * El sistema le pedía que probara ser quien ya sabía que era.
   *
   * Va antes que el aviso del motivo a propósito: un link vencido o ya usado
   * deja de importar si la sesión que ese link iba a abrir ya está abierta.
   */
  const galleta = await cookies();
  if (await cuentaDeSesion(galleta.get(COOKIE_SESION)?.value)) redirect("/mi");

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
