import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";

const url =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://wishlist:wishlist@localhost:5432/wishlist_test";

export const testDbUrl = url;

let client: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      datasources: { db: { url } },
    });
  }
  return client;
}

export async function setupTestDatabase(): Promise<boolean> {
  try {
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: url },
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

export async function resetTestData(prisma: PrismaClient) {
  await prisma.notification.deleteMany();
  await prisma.contribution.deleteMany();
  await prisma.item.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.friendRequest.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.user.deleteMany();
}

export async function disconnectTestPrisma() {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
