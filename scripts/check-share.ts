import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const share = await p.$queryRaw<
    Array<{ indexname: string; indexdef: string }>
  >`SELECT indexname, indexdef FROM pg_indexes WHERE tablename='Wishlist' AND indexdef ILIKE '%shareToken%'`;
  console.log("shareToken indexes:", share);

  const w = await p.wishlist.findFirst({
    where: { isPublic: true },
    select: { id: true, shareToken: true, title: true },
  });
  console.log("public wishlist:", w);

  const any = await p.wishlist.findFirst({
    select: { id: true, shareToken: true, isPublic: true, title: true },
  });
  console.log("any wishlist:", any);
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
