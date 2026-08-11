import { Item, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publishUserNotification, publishWishlistUpdate } from "@/lib/realtime";

type ItemWithContributions = Item & {
  contributions: { id: string; userId: string; amount: Prisma.Decimal }[];
  wishlist: { id: string; title: string; ownerId: string; owner: { displayName: string } };
};

export function hasPendingRefunds(item: {
  contributions: unknown[];
  amountCollected: Prisma.Decimal | number | string;
  price: Prisma.Decimal | number | string;
  status: string;
}) {
  if (item.status === "CANCELLED") return false;
  const collected = Number(item.amountCollected);
  const price = Number(item.price);
  return item.contributions.length > 0 && collected > 0 && collected < price;
}

export function pendingRefundSummary(
  items: {
    id: string;
    name: string;
    contributions: { userId: string; amount: Prisma.Decimal | number | string }[];
    amountCollected: Prisma.Decimal | number | string;
    price: Prisma.Decimal | number | string;
    status: string;
  }[],
) {
  const pending = items.filter(hasPendingRefunds);
  const contributorIds = new Set<string>();
  let totalAmount = 0;

  for (const item of pending) {
    totalAmount += Number(item.amountCollected);
    for (const c of item.contributions) {
      contributorIds.add(c.userId);
    }
  }

  return {
    items: pending.map((i) => ({
      id: i.id,
      name: i.name,
      contributorCount: i.contributions.length,
      totalAmount: Number(i.amountCollected),
    })),
    itemCount: pending.length,
    contributorCount: contributorIds.size,
    totalAmount,
  };
}

export async function cancelItemWithRefunds(item: ItemWithContributions) {
  if (!hasPendingRefunds(item)) {
    return { cancelled: false as const };
  }

  const ownerName = item.wishlist.owner.displayName;

  await prisma.$transaction(async (tx) => {
    await tx.item.update({
      where: { id: item.id },
      data: { status: "CANCELLED", reservedById: null },
    });

    for (const c of item.contributions) {
      await tx.notification.create({
        data: {
          userId: c.userId,
          type: "ITEM_CANCELLED_REFUND_DUE",
          payload: {
            itemId: item.id,
            itemName: item.name,
            wishlistId: item.wishlist.id,
            wishlistTitle: item.wishlist.title,
            amount: Number(c.amount),
            actorName: ownerName,
            contributionId: c.id,
            refunded: false,
          },
        },
      });
    }
  });

  await publishWishlistUpdate(item.wishlistId);
  for (const c of item.contributions) {
    await publishUserNotification(c.userId);
  }

  return { cancelled: true as const };
}

export async function cancelWishlistPendingItems(wishlistId: string) {
  const items = await prisma.item.findMany({
    where: {
      wishlistId,
      status: { not: "CANCELLED" },
    },
    include: {
      contributions: true,
      wishlist: { include: { owner: true } },
    },
  });

  let cancelledCount = 0;
  for (const item of items) {
    if (hasPendingRefunds(item)) {
      await cancelItemWithRefunds(item);
      cancelledCount++;
    }
  }

  return cancelledCount;
}
