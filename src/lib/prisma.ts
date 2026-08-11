import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Always cache on globalThis so serverless warm invocations reuse one client
// (avoids exhausting Neon connection limits on the free tier).
globalForPrisma.prisma = prisma;
