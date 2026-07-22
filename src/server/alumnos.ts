import { randomUUID } from "node:crypto";

import { env } from "~/env";
import { armarAlias, talo } from "~/server/talo";
import { db } from "./db";
import { imputarPagos } from "./dominio";
import { notificarInvitacion } from "./notificaciones";

/**
 * Alta de alumnos. Cada uno necesita su customer en Talo —el CVU va por alumno
 * y no por cuenta, para que la transferencia de una familia con dos hijos se
 * pueda imputar sin ambigüedad.
 */

export async function crearAlumno(input: {
  grupoId: string;
  nombre: string;
  emailContacto?: string | null;
}) {
  const grupo = await db.grupo.findUniqueOrThrow({
    where: { id: input.grupoId },
  });

  const nombre = input.nombre.trim();

  // Idempotente por nombre dentro del grupo: pegar dos veces la misma lista no
  // duplica alumnos.
  const existente = await db.alumno.findFirst({
    where: { grupoId: grupo.id, nombre },
  });
  if (existente) return { alumno: existente, yaExistia: true };

  const id = randomUUID();
  const cliente = await talo.crearCustomer({
    customerId: id,
    nombre,
    email: input.emailContacto ?? env.ADMIN_EMAIL,
    aliasSugerido: armarAlias(grupo.colegio, nombre),
    webhookUrl: `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/talo`,
  });

  const alumno = await db.alumno.create({
    data: {
      id,
      grupoId: grupo.id,
      nombre,
      emailContacto: input.emailContacto?.trim().toLowerCase() || null,
      token: randomUUID(),
      taloCustomerId: cliente.customerId,
      cvu: cliente.cvu,
      alias: cliente.alias,
    },
  });

  return { alumno, yaExistia: false };
}

/** Invitación al email de contacto, con el link del grupo para registrarse. */
export async function invitarFamilia(alumnoId: string) {
  const alumno = await db.alumno.findUniqueOrThrow({
    where: { id: alumnoId },
    include: {
      grupo: { include: { cuotas: true } },
      cuenta: true,
      pagos: true,
    },
  });

  // Si la familia ya se registró, el mail va a la cuenta; si no, al contacto
  // que cargó el admin.
  const email = alumno.cuenta?.email ?? alumno.emailContacto;
  if (!email) return { enviado: false as const };

  const plan = imputarPagos(
    alumno.grupo.cuotas,
    alumno.pagos.reduce((t, p) => t + Number(p.monto), 0),
  );

  await notificarInvitacion(
    { alumno, grupo: alumno.grupo, email },
    plan.proxima
      ? {
          numero: plan.proxima.numero,
          total: alumno.grupo.cuotas.length,
          monto: plan.proxima.monto,
          venceEl: plan.proxima.venceEl,
        }
      : null,
  );

  return { enviado: true as const };
}

/**
 * Parsea el pegado en bloque del panel: un alumno por línea, opcionalmente con
 * el email de contacto de la familia.
 */
export function parsearAlumnos(texto: string) {
  const filas: { nombre: string; emailContacto?: string }[] = [];
  const errores: string[] = [];

  for (const linea of texto.split("\n")) {
    const limpia = linea.trim();
    if (!limpia) continue;

    const partes = limpia.split(/[,;\t]/).map((p) => p.trim());
    const nombre = partes[0] ?? "";
    const email = partes[1] ?? "";

    if (!nombre) {
      errores.push(limpia);
      continue;
    }
    if (email && !email.includes("@")) {
      errores.push(limpia);
      continue;
    }

    filas.push({ nombre, emailContacto: email || undefined });
  }

  return { filas, errores };
}
