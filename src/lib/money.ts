export function formatRub(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return `${n.toLocaleString("ru-RU")} ₽`;
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export {
  calcCollectedPercent,
  wishlistProgress,
  isItemFundingFulfilled,
} from "@/lib/wishlist-progress";

export {
  computeSplitPerPerson,
  amountForSplitIndex,
  computeSplitBreakdown,
  shouldCloseFixedSplit,
  canJoinFixedSplit,
} from "@/lib/split-calculator";

import { calcCollectedPercent } from "@/lib/wishlist-progress";

/** @deprecated use calcCollectedPercent */
export function itemFundingPercent(
  amountCollected: number | string,
  price: number | string,
): number {
  return calcCollectedPercent(Number(amountCollected), Number(price));
}
