import { randomUUID } from "node:crypto";

import { armarAlias, talo } from "~/server/talo";
import { env } from "~/env";
import { db } from "./db";
import { montoDe } from "./dominio";
import { notificarInvitacion } from "./notificaciones";

/**
 * Alta de padres. Lo usan tanto la carga del administrador como el
 * auto-registro desde el link público del grupo: en los dos casos hay que
 * pedirle a Talo el CVU/alias antes de tener un padre utilizable.
 */

export type OrigenAlta = "ADMIN" | "AUTO_REGISTRO";

export async function crearPadre(input: {
  grupoId: string;
  nombre: string;
  email: string;
  telefono?: string | null;
  montoCuota?: number | null;
  origen: OrigenAlta;
}) {
  const grupo = await db.grupo.findUniqueOrThrow({
    where: { id: input.grupoId },
  });

  // Idempotente por email dentro del grupo: si el padre vuelve a entrar al
  // link de auto-registro no se duplica, recupera el suyo.
  const existente = await db.padre.findFirst({
    where: { grupoId: grupo.id, email: input.email.toLowerCase() },
  });
  if (existente) return { padre: existente, yaExistia: true };

  const id = randomUUID();
  const cliente = await talo.crearCustomer({
    customerId: id,
    nombre: input.nombre,
    email: input.email,
    aliasSugerido: armarAlias(grupo.colegio, input.nombre),
    webhookUrl: `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/talo`,
  });

  const padre = await db.padre.create({
    data: {
      id,
      grupoId: grupo.id,
      nombre: input.nombre.trim(),
      email: input.email.trim().toLowerCase(),
      telefono: input.telefono?.trim() || null,
      montoCuota: input.montoCuota ?? null,
      token: randomUUID(),
      taloCustomerId: cliente.customerId,
      cvu: cliente.cvu,
      alias: cliente.alias,
      origen: input.origen,
    },
  });

  return { padre, yaExistia: false };
}

/** Manda (o remanda) la invitación con el link personal. */
export async function invitarPadre(padreId: string) {
  const padre = await db.padre.findUniqueOrThrow({
    where: { id: padreId },
    include: { grupo: true },
  });

  await notificarInvitacion(
    { padre, grupo: padre.grupo },
    montoDe(padre, padre.grupo),
  );

  return db.padre.update({
    where: { id: padre.id },
    data: { invitadoEl: new Date() },
  });
}

/**
 * Parsea el pegado en bloque del panel. Acepta una línea por padre, con el
 * nombre y el email separados por coma, punto y coma o tabulación.
 */
export function parsearPadres(texto: string) {
  const filas: { nombre: string; email: string }[] = [];
  const errores: string[] = [];

  for (const linea of texto.split("\n")) {
    const limpia = linea.trim();
    if (!limpia) continue;

    const partes = limpia.split(/[,;\t]/).map((p) => p.trim());
    const nombre = partes[0] ?? "";
    const email = partes[1] ?? "";

    if (!nombre || !email || !email.includes("@")) {
      errores.push(limpia);
      continue;
    }
    filas.push({ nombre, email: email.toLowerCase() });
  }

  return { filas, errores };
}
