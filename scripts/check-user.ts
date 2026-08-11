import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const u = await p.user.findUnique({ where: { email: "demo@wishlist.app" } });
  console.log(
    JSON.stringify(
      {
        id: u?.id,
        email: u?.email,
        name: u?.displayName,
        handle: u?.handle,
        avatar: u?.avatarUrl,
        hashLen: u?.passwordHash?.length,
        keys: u && Object.keys(u),
        jsonLen: JSON.stringify(u).length,
      },
      null,
      2,
    ),
  );
  await p.$disconnect();
}

main();
