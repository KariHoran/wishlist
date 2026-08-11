import { NotificationType, Prisma } from "@prisma/client";

type Listener = (payload: { wishlistId?: string; userId?: string; at: number }) => void;

const g = globalThis as unknown as {
  __wishlistBus?: Map<string, Set<Listener>>;
  __userNotifBus?: Map<string, Set<Listener>>;
};

function wishlistBus() {
  if (!g.__wishlistBus) g.__wishlistBus = new Map();
  return g.__wishlistBus;
}

function userBus() {
  if (!g.__userNotifBus) g.__userNotifBus = new Map();
  return g.__userNotifBus;
}

export function subscribeWishlist(wishlistId: string, listener: Listener) {
  const m = wishlistBus();
  if (!m.has(wishlistId)) m.set(wishlistId, new Set());
  m.get(wishlistId)!.add(listener);
  return () => {
    m.get(wishlistId)?.delete(listener);
  };
}

export function subscribeUserNotifications(userId: string, listener: Listener) {
  const m = userBus();
  if (!m.has(userId)) m.set(userId, new Set());
  m.get(userId)!.add(listener);
  return () => {
    m.get(userId)?.delete(listener);
  };
}

export async function publishWishlistUpdate(wishlistId: string) {
  const payload = { wishlistId, at: Date.now() };
  const listeners = wishlistBus().get(wishlistId);
  if (listeners) {
    for (const l of listeners) l(payload);
  }

  await triggerPusher(`wishlist-${wishlistId}`, "update", payload);
}

export async function publishUserNotification(userId: string) {
  const payload = { userId, at: Date.now() };
  const listeners = userBus().get(userId);
  if (listeners) {
    for (const l of listeners) l(payload);
  }

  await triggerPusher(`user-${userId}`, "notification", payload);
}

async function triggerPusher(channel: string, event: string, payload: object) {
  if (
    process.env.PUSHER_APP_ID &&
    process.env.PUSHER_KEY &&
    process.env.PUSHER_SECRET
  ) {
    try {
      const Pusher = (await import("pusher")).default;
      const pusher = new Pusher({
        appId: process.env.PUSHER_APP_ID,
        key: process.env.PUSHER_KEY,
        secret: process.env.PUSHER_SECRET,
        cluster: process.env.PUSHER_CLUSTER || "eu",
        useTLS: true,
      });
      await pusher.trigger(channel, event, payload);
    } catch (e) {
      console.warn("Pusher publish failed", e);
    }
  }
}
