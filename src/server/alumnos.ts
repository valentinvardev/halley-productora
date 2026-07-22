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

/**
 * A quiénes hay que escribirles por este alumno: a todos los responsables
 * registrados, y si todavía no hay ninguno, al contacto que cargó el admin.
 */
export function destinatarios(alumno: {
  emailContacto: string | null;
  tutores: { cuenta: { email: string } }[];
}) {
  const registrados = alumno.tutores.map((t) => t.cuenta.email);
  if (registrados.length > 0) return registrados;
  return alumno.emailContacto ? [alumno.emailContacto] : [];
}

/** Invitación a registrarse, al contacto o a los responsables que ya haya. */
export async function invitarFamilia(alumnoId: string) {
  const alumno = await db.alumno.findUniqueOrThrow({
    where: { id: alumnoId },
    include: {
      grupo: { include: { cuotas: true } },
      tutores: { include: { cuenta: true } },
      pagos: true,
    },
  });

  const emails = destinatarios(alumno);
  if (emails.length === 0) return { enviado: false as const };

  const plan = imputarPagos(
    alumno.grupo.cuotas,
    alumno.pagos.reduce((t, p) => t + Number(p.monto), 0),
  );

  const cuota = plan.proxima
    ? {
        numero: plan.proxima.numero,
        total: alumno.grupo.cuotas.length,
        monto: plan.proxima.saldo,
        venceEl: plan.proxima.venceEl,
      }
    : null;

  for (const email of emails) {
    await notificarInvitacion({ alumno, grupo: alumno.grupo, email }, cuota);
  }

  return { enviado: true as const, cantidad: emails.length };
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
