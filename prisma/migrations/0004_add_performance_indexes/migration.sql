-- Performance indexes for dashboard / wishlist / friends / notifications.
-- Most were already created in 0001_init and 0002_friend_requests; IF NOT EXISTS
-- keeps this migration safe to re-apply on any environment.
-- Wishlist.shareToken @unique already provides Wishlist_shareToken_key (btree).
-- Drop the redundant non-unique Wishlist_shareToken_idx if present.

CREATE INDEX IF NOT EXISTS "Wishlist_ownerId_idx" ON "Wishlist"("ownerId");
CREATE INDEX IF NOT EXISTS "Item_wishlistId_idx" ON "Item"("wishlistId");
CREATE INDEX IF NOT EXISTS "Contribution_itemId_idx" ON "Contribution"("itemId");
CREATE INDEX IF NOT EXISTS "Contribution_userId_idx" ON "Contribution"("userId");
CREATE INDEX IF NOT EXISTS "FriendRequest_toId_status_idx" ON "FriendRequest"("toId", "status");
CREATE INDEX IF NOT EXISTS "FriendRequest_fromId_status_idx" ON "FriendRequest"("fromId", "status");
CREATE INDEX IF NOT EXISTS "Friendship_userAId_idx" ON "Friendship"("userAId");
CREATE INDEX IF NOT EXISTS "Friendship_userBId_idx" ON "Friendship"("userBId");
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

DROP INDEX IF EXISTS "Wishlist_shareToken_idx";
