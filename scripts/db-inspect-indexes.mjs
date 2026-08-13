import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const rows = await p.$queryRaw`
  SELECT indexname, tablename, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename IN ('Wishlist','Item','Contribution','FriendRequest','Friendship','Notification')
  ORDER BY tablename, indexname
`;
console.log("INDEXES");
console.log(JSON.stringify(rows, null, 2));

const cols = await p.$queryRaw`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'Wishlist'
  ORDER BY ordinal_position
`;
console.log("WISHLIST_COLS");
console.log(JSON.stringify(cols, null, 2));

const counts = await p.$queryRaw`
  SELECT
    (SELECT count(*)::int FROM "Wishlist") AS wishlists,
    (SELECT count(*)::int FROM "Item") AS items,
    (SELECT count(*)::int FROM "User") AS users
`;
console.log("COUNTS", JSON.stringify(counts));

await p.$disconnect();
