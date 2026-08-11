import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  await p.user.updateMany({
    where: { avatarUrl: { startsWith: "data:" } },
    data: { avatarUrl: "/decor/avatar-cat.svg" },
  });
  console.log("Cleared oversized data: avatar URLs");
  await p.$disconnect();
}

main();
