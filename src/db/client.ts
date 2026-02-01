import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: [
      { level: "warn", emit: "event" },
      { level: "error", emit: "event" },
    ],
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

prisma.$on("warn", (e) => {
  logger.warn(e);
});

prisma.$on("error", (e) => {
  logger.error(e);
});

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}
