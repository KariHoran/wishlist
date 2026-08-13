import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ClientItem } from "@/components/WishlistView";

export type SharedWishlistData = {
  id: string;
  title: string;
  emoji: string | null;
  isPublic: boolean;
  ownerId: string;
  deadline: string | null;
  items: ClientItem[];
  itemCount: number;
};

function mapSharedItems(
  items: {
    id: string;
    name: string;
    price: { toString(): string };
    imageUrl: string | null;
    productUrl: string | null;
    status: ClientItem["status"];
    amountCollected: { toString(): string };
    fundingMode: "FREE" | "FIXED_SPLIT";
    splitParticipants: number | null;
    splitAmountPerPerson: { toString(): string } | null;
    reservationMessage: string | null;
    reservationAnonymous: boolean;
    reservedById: string | null;
    reservedBy: { id: string; displayName: string; handle: string } | null;
    contributions: {
      id: string;
      amount: { toString(): string };
      message: string | null;
      isAnonymous: boolean;
      user: { id: string; displayName: string; handle: string };
    }[];
  }[],
): ClientItem[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price.toString(),
    imageUrl: item.imageUrl,
    productUrl: item.productUrl,
    status: item.status,
    amountCollected: item.amountCollected.toString(),
    fundingMode: item.fundingMode,
    splitParticipants: item.splitParticipants,
    splitAmountPerPerson: item.splitAmountPerPerson
      ? item.splitAmountPerPerson.toString()
      : null,
    reservationMessage: item.reservationMessage,
    reservationAnonymous: item.reservationAnonymous,
    reservedById: item.reservedById,
    reservedBy: item.reservedBy
      ? item.reservationAnonymous
        ? { id: item.reservedBy.id, displayName: "Аноним", handle: "anon" }
        : item.reservedBy
      : null,
    contributions: item.contributions.map((c) => ({
      id: c.id,
      amount: c.amount.toString(),
      message: c.message,
      isAnonymous: c.isAnonymous,
      user: c.isAnonymous
        ? { id: c.user.id, displayName: "Аноним", handle: "anon" }
        : c.user,
    })),
    contributorCount: item.contributions.length,
  }));
}

async function loadSharedWishlist(
  shareToken: string,
): Promise<SharedWishlistData | null> {
  const wishlist = await prisma.wishlist.findUnique({
    where: { shareToken },
    include: {
      items: {
        where: { status: { not: "CANCELLED" } },
        include: {
          contributions: {
            where: { refunded: false },
            include: {
              user: { select: { id: true, displayName: true, handle: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          reservedBy: {
            select: { id: true, displayName: true, handle: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!wishlist) return null;

  const items = mapSharedItems(wishlist.items);
  return {
    id: wishlist.id,
    title: wishlist.title,
    emoji: wishlist.emoji,
    isPublic: wishlist.isPublic,
    ownerId: wishlist.ownerId,
    deadline: wishlist.deadline
      ? wishlist.deadline.toISOString().slice(0, 10)
      : null,
    items,
    itemCount: items.length,
  };
}

/** Public share payload — cached so Neon sleep + cold queries don't hit every request. */
export function getSharedWishlist(shareToken: string) {
  return unstable_cache(
    () => loadSharedWishlist(shareToken),
    ["shared-wishlist", shareToken],
    { revalidate: 60, tags: [`shared-wishlist:${shareToken}`] },
  )();
}
