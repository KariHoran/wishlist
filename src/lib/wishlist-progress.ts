export type ProgressItem = { status: string };

export type WishlistProgress = {
  total: number;
  collected: number;
  percent: number;
  done: number;
  isFulfilled: boolean;
};

/** Wishlist-level progress: share of items that are reserved or in active funding. */
export function wishlistProgress(items: ProgressItem[]): WishlistProgress {
  const active = items.filter((i) => i.status !== "CANCELLED");
  const total = active.length;
  const collected = active.filter((i) => i.status === "RESERVED").length;
  const done = active.filter(
    (i) => i.status === "RESERVED" || i.status === "FUNDING",
  ).length;
  const percent = total === 0 ? 0 : Math.round((collected / total) * 100);
  const isFulfilled = total > 0 && done === total;
  return { total, collected, percent, done, isFulfilled };
}

export function calcCollectedPercent(collected: number, price: number): number {
  if (price <= 0) return 0;
  return Math.min(100, (collected / price) * 100);
}

export function isItemFundingFulfilled(
  amountCollected: number,
  price: number,
): boolean {
  return price > 0 && amountCollected >= price;
}
