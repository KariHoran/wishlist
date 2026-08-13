import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function explain(label, sql, preamble = "") {
  if (preamble) await p.$executeRawUnsafe(preamble);
  const rows = await p.$queryRawUnsafe(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`,
  );
  console.log(`\n===== ${label} =====`);
  for (const r of rows) console.log(r["QUERY PLAN"]);
}

const sample = await p.$queryRaw`
  SELECT w.id AS wishlist_id, w."ownerId" AS owner_id, w."shareToken" AS share_token
  FROM "Wishlist" w LIMIT 1
`;
const { wishlist_id, owner_id, share_token } = sample[0];
console.log("SAMPLE", { wishlist_id, owner_id, share_token });

const dashSql = `SELECT w.id, w.title, w."createdAt" FROM "Wishlist" w WHERE w."ownerId" = '${owner_id}' ORDER BY w."createdAt" DESC`;
const listSql = `SELECT i.id, i.name, i.status, i.price FROM "Item" i WHERE i."wishlistId" = '${wishlist_id}' AND i.status <> 'CANCELLED' ORDER BY i."createdAt" ASC`;
const shareSql = `SELECT w.id, w.title FROM "Wishlist" w WHERE w."shareToken" = '${share_token}'`;

// Realistic plan on tiny tables (planner prefers seq scan — both with and without index)
await p.$executeRawUnsafe("BEGIN");
try {
  await p.$executeRawUnsafe(`DROP INDEX IF EXISTS "Wishlist_ownerId_idx"`);
  await p.$executeRawUnsafe(`DROP INDEX IF EXISTS "Item_wishlistId_idx"`);
  await explain("A) Tiny DB, indexes DROPPED — dashboard by ownerId", dashSql);
  await explain("A) Tiny DB, indexes DROPPED — items by wishlistId", listSql);
} finally {
  await p.$executeRawUnsafe("ROLLBACK");
}

await explain("B) Tiny DB, indexes PRESENT — dashboard by ownerId", dashSql);
await explain("B) Tiny DB, indexes PRESENT — items by wishlistId", listSql);
await explain("B) shareToken UNIQUE index available — lookup", shareSql);

// Force index usage to prove indexes are usable when seqscan is discouraged
await p.$executeRawUnsafe("BEGIN");
try {
  await p.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
  await explain("C) enable_seqscan=off — dashboard uses Index Scan", dashSql);
  await explain("C) enable_seqscan=off — items uses Index Scan", listSql);
  await explain("C) enable_seqscan=off — shareToken Index Scan", shareSql);
} finally {
  await p.$executeRawUnsafe("ROLLBACK");
}

await p.$disconnect();
