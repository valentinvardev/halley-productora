/**
 * Muda la base entera de un proyecto de Supabase a otro.
 *
 * Supabase no deja cambiar la región de un proyecto: hay que crear uno nuevo en
 * la región que se quiere y llevar los datos. Esto último es lo que hace este
 * script.
 *
 *   1. En el proyecto nuevo, aplicar el esquema:
 *        DATABASE_URL="<destino>" npx prisma db push
 *   2. Poner el connection string del destino en DATABASE_URL_DESTINO
 *   3. node --env-file=.env scripts/migrar-base.mjs
 *
 * Lee de una base y escribe en la otra en el mismo proceso, sin pasar por JSON:
 * así los Decimal de los montos y las fechas viajan como son y no hay que
 * confiar en que se serialicen y se vuelvan a leer igual.
 *
 * El orden de las tablas es el de las claves foráneas — cada una entra después
 * de aquello a lo que apunta.
 */

import { PrismaClient } from "../generated/prisma/index.js";

const ORIGEN = process.env.DATABASE_URL;
const DESTINO = process.env.DATABASE_URL_DESTINO;

if (!ORIGEN || !DESTINO) {
  console.error(
    "Faltan DATABASE_URL (origen) y/o DATABASE_URL_DESTINO en el entorno.",
  );
  process.exit(1);
}

if (ORIGEN === DESTINO) {
  console.error("El origen y el destino son la misma base.");
  process.exit(1);
}

const vaciar = process.argv.includes("--vaciar");

const origen = new PrismaClient({ datasourceUrl: ORIGEN });
const destino = new PrismaClient({ datasourceUrl: DESTINO });

/** De la que menos depende a la que más: es el orden en que se puede insertar. */
const TABLAS = [
  "grupo",
  "cuota",
  "alumno",
  "cuenta",
  "tutor",
  "sesion",
  "enlaceAcceso",
  "pago",
  "galeria",
  "notificacion",
  "transaccionMockTalo",
];

async function main() {
  console.log("origen  :", ORIGEN.replace(/:[^:@]+@/, ":***@"));
  console.log("destino :", DESTINO.replace(/:[^:@]+@/, ":***@"));
  console.log();

  // Nunca escribir encima de algo sin decirlo: si el destino tiene datos, se
  // frena salvo que se pida vaciarlo explícitamente.
  const ocupado = [];
  for (const tabla of TABLAS) {
    const n = await destino[tabla].count();
    if (n > 0) ocupado.push(`${tabla} (${n})`);
  }

  if (ocupado.length > 0 && !vaciar) {
    console.error("El destino ya tiene datos:", ocupado.join(", "));
    console.error("Volvé a correrlo con --vaciar si querés reemplazarlos.");
    process.exit(1);
  }

  if (ocupado.length > 0) {
    console.log("Vaciando el destino…");
    for (const tabla of [...TABLAS].reverse()) {
      await destino[tabla].deleteMany();
    }
    console.log();
  }

  let total = 0;
  for (const tabla of TABLAS) {
    const filas = await origen[tabla].findMany();
    if (filas.length === 0) {
      console.log(`${String(0).padStart(5)}  ${tabla}`);
      continue;
    }

    // `skipDuplicates` no: si algo choca, quiero enterarme.
    await destino[tabla].createMany({ data: filas });
    total += filas.length;
    console.log(`${String(filas.length).padStart(5)}  ${tabla}`);
  }

  console.log(`\n${total} filas migradas.`);

  // Verificación: no alcanza con que no haya tirado error.
  console.log("\nComprobando…");
  let diferencias = 0;
  for (const tabla of TABLAS) {
    const [a, b] = await Promise.all([
      origen[tabla].count(),
      destino[tabla].count(),
    ]);
    if (a !== b) {
      console.error(`  ${tabla}: origen ${a} ≠ destino ${b}`);
      diferencias += 1;
    }
  }

  if (diferencias > 0) {
    console.error(`\n${diferencias} tabla(s) no coinciden.`);
    process.exit(1);
  }

  console.log("  Todas las tablas coinciden.");
}

try {
  await main();
} finally {
  await origen.$disconnect();
  await destino.$disconnect();
}
