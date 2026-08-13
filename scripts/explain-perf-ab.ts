/**
 * Fair index A/B: inflate rows → EXPLAIN without indexes → recreate → EXPLAIN with indexes.
 * Cleans up synthetic rows at the end. Does NOT touch real seed data.
 *
 *   npx tsx scripts/explain-perf-ab.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FAKE_OWNER = "__perf_bench_owner__";
const FAKE_WL = "__perf_bench_wishlist__";

async function explain(title: string, sql: string) {
  console.log(`\n========== ${title} ==========`);
  const rows = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`,
  );
  for (const row of rows) console.log(row["QUERY PLAN"]);
}

async function listHotIndexes() {
  const rows = await prisma.$queryRaw<
    Array<{ indexname: string; tablename: string }>
  >`
    SELECT indexname, tablename FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'Wishlist_ownerId_idx','Item_wishlistId_idx',
        'Contribution_itemId_idx','Contribution_userId_idx',
        'FriendRequest_toId_status_idx','FriendRequest_fromId_status_idx',
        'Friendship_userAId_idx','Friendship_userBId_idx',
        'Notification_userId_isRead_idx','Wishlist_shareToken_idx',
        'Wishlist_shareToken_key'
      )
    ORDER BY tablename, indexname
  `;
  console.log("\n--- hot indexes ---");
  for (const r of rows) console.log(`${r.tablename}.${r.indexname}`);
  return rows.map((r) => r.indexname);
}

async function dropPerfIndexes() {
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "Wishlist_ownerId_idx"`);
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "Item_wishlistId_idx"`);
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "Contribution_itemId_idx"`);
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "Contribution_userId_idx"`);
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "Notification_userId_isRead_idx"`);
}

async function createPerfIndexes() {
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Wishlist_ownerId_idx" ON "Wishlist"("ownerId")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Item_wishlistId_idx" ON "Item"("wishlistId")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Contribution_itemId_idx" ON "Contribution"("itemId")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Contribution_userId_idx" ON "Contribution"("userId")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead")`,
  );
}

async function seedBulk() {
  // 5k wishlists for one owner + noise for others; 20k items; 30k contributions; 10k notifications
  console.log("Seeding bulk rows for benchmark…");
  await prisma.$executeRawUnsafe(`
    INSERT INTO "User" (id, email, handle, "displayName", "passwordHash", "createdAt")
    VALUES (
      '${FAKE_OWNER}',
      'perf-bench@example.com',
      'perfbench',
      'Perf Bench',
      'x',
      NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "Wishlist" (id, "ownerId", title, "isPublic", "shareToken", "createdAt")
    SELECT
      '${FAKE_WL}_' || g::text,
      CASE WHEN g <= 5000 THEN '${FAKE_OWNER}' ELSE 'cmsogqrdl0000ugukwp0265eg' END,
      'Bench WL ' || g::text,
      false,
      'bench_tok_' || g::text,
      NOW()
    FROM generate_series(1, 8000) AS g
    ON CONFLICT (id) DO NOTHING
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "Item" (id, "wishlistId", name, price, status, "amountCollected", "fundingMode", "reservationAnonymous", "createdAt")
    SELECT
      'bench_item_' || g::text,
      '${FAKE_WL}_' || ((g % 5000) + 1)::text,
      'Item ' || g::text,
      100.00,
      'AVAILABLE',
      0,
      'FREE',
      false,
      NOW()
    FROM generate_series(1, 20000) AS g
    ON CONFLICT (id) DO NOTHING
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "Contribution" (id, "itemId", "userId", amount, refunded, "isAnonymous", "createdAt")
    SELECT
      'bench_c_' || g::text,
      'bench_item_' || ((g % 20000) + 1)::text,
      '${FAKE_OWNER}',
      10.00,
      false,
      false,
      NOW()
    FROM generate_series(1, 30000) AS g
    ON CONFLICT (id) DO NOTHING
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "Notification" (id, "userId", type, payload, "isRead", "createdAt")
    SELECT
      'bench_n_' || g::text,
      '${FAKE_OWNER}',
      'GOAL_REACHED',
      '{}'::jsonb,
      (g % 5 = 0),
      NOW()
    FROM generate_series(1, 10000) AS g
    ON CONFLICT (id) DO NOTHING
  `);

  await prisma.$executeRawUnsafe(`ANALYZE "Wishlist"`);
  await prisma.$executeRawUnsafe(`ANALYZE "Item"`);
  await prisma.$executeRawUnsafe(`ANALYZE "Contribution"`);
  await prisma.$executeRawUnsafe(`ANALYZE "Notification"`);
  console.log("Bulk seed done.");
}

async function cleanupBulk() {
  console.log("Cleaning bulk rows…");
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Notification" WHERE id LIKE 'bench_n_%'`,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Contribution" WHERE id LIKE 'bench_c_%'`,
  );
  await prisma.$executeRawUnsafe(`DELETE FROM "Item" WHERE id LIKE 'bench_item_%'`);
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Wishlist" WHERE id LIKE '${FAKE_WL}_%'`,
  );
  await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE id = '${FAKE_OWNER}'`);
  console.log("Cleanup done.");
}

async function runExplains(tag: string) {
  await explain(
    `${tag}: Dashboard wishlists by ownerId`,
    `SELECT id, title FROM "Wishlist" WHERE "ownerId" = '${FAKE_OWNER}' ORDER BY "createdAt" DESC`,
  );
  await explain(
    `${tag}: Items by wishlistId`,
    `SELECT id, name FROM "Item" WHERE "wishlistId" = '${FAKE_WL}_1' AND status <> 'CANCELLED' ORDER BY "createdAt" ASC`,
  );
  await explain(
    `${tag}: Unread notifications`,
    `SELECT id FROM "Notification" WHERE "userId" = '${FAKE_OWNER}' AND "isRead" = false ORDER BY "createdAt" DESC LIMIT 50`,
  );
}

async function main() {
  try {
    await listHotIndexes();
    await seedBulk();

    console.log("\n>>> BEFORE: dropping hot indexes");
    await dropPerfIndexes();
    await listHotIndexes();
    await runExplains("BEFORE (no indexes)");

    console.log("\n>>> AFTER: recreating hot indexes");
    await createPerfIndexes();
    await prisma.$executeRawUnsafe(`ANALYZE "Wishlist"`);
    await prisma.$executeRawUnsafe(`ANALYZE "Item"`);
    await prisma.$executeRawUnsafe(`ANALYZE "Contribution"`);
    await prisma.$executeRawUnsafe(`ANALYZE "Notification"`);
    await listHotIndexes();
    await runExplains("AFTER (with indexes)");
  } finally {
    await cleanupBulk();
    // Ensure indexes exist even if something failed mid-run
    await createPerfIndexes();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
