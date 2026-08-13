SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('Wishlist','Item','Contribution','FriendRequest','Friendship','Notification')
ORDER BY tablename, indexname;
