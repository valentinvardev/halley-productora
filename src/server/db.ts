// Si un componente de cliente llega a importar esto —aunque sea de rebote, por
// una constante que comparte módulo con la base—, el build falla acá y no en el
// navegador del usuario. Es la red que faltó cuando Contenidos se rompió.
import "server-only";

import { env } from "~/env";
import { PrismaClient } from "../../generated/prisma";

const createPrismaClient = () =>
  new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
