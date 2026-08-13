/**
 * One-shot EXPLAIN ANALYZE for dashboard + wishlist hot paths.
 * Usage: npx tsx scripts/explain-perf.ts [before|after]
 */
import { PrismaClient } from "@prisma/client";

const label = process.argv[2] ?? "run";
const prisma = new PrismaClient();

async function explain(title: string, sql: string) {
  console.log(`\n========== ${title} (${label}) ==========`);
  const rows = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`,
  );
  for (const row of rows) {
    console.log(row["QUERY PLAN"]);
  }
}

async function main() {
  const idx = await prisma.$queryRaw<
    Array<{ tablename: string; indexname: string }>
  >`
    SELECT tablename, indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN (
        'Wishlist','Item','Contribution','FriendRequest',
        'Friendship','Notification'
      )
    ORDER BY tablename, indexname
  `;
  console.log(`\n========== indexes present (${label}) ==========`);
  for (const r of idx) console.log(`${r.tablename}.${r.indexname}`);

  const shareTok = await prisma.$queryRaw<
    Array<{ indexname: string; indexdef: string }>
  >`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'Wishlist'
      AND indexdef ILIKE '%"shareToken"%'
  `;
  console.log(`\n========== Wishlist.shareToken indexes (${label}) ==========`);
  for (const r of shareTok) console.log(`${r.indexname}: ${r.indexdef}`);

  const owner = await prisma.user.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!owner) {
    console.log("No users — seed the DB first.");
    return;
  }

  const wl = await prisma.wishlist.findFirst({
    where: { items: { some: {} } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  // Dashboard: wishlists by owner (+ items via FK)
  await explain(
    "Dashboard: Wishlist by ownerId",
    `SELECT * FROM "Wishlist" WHERE "ownerId" = '${owner.id}' ORDER BY "createdAt" DESC`,
  );

  if (wl) {
    await explain(
      "Wishlist page: Items by wishlistId",
      `SELECT * FROM "Item" WHERE "wishlistId" = '${wl.id}' AND status <> 'CANCELLED' ORDER BY "createdAt" ASC`,
    );
    await explain(
      "Wishlist page: Contributions for items in wishlist",
      `SELECT c.* FROM "Contribution" c
       JOIN "Item" i ON i.id = c."itemId"
       WHERE i."wishlistId" = '${wl.id}' AND c.refunded = false
       ORDER BY c."createdAt" ASC`,
    );
  }

  await explain(
    "Notifications: unread for user",
    `SELECT * FROM "Notification" WHERE "userId" = '${owner.id}' AND "isRead" = false ORDER BY "createdAt" DESC LIMIT 50`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
