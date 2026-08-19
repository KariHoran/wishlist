import {
  bcp47,
  defaultCurrency,
  type AppLocale,
  type WishlistCurrency,
} from "@/i18n/config";

export function formatCurrency(
  amount: number | string,
  currency: WishlistCurrency = defaultCurrency,
  locale: AppLocale = "ru",
): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat(bcp47(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

/** @deprecated use formatCurrency */
export function formatRub(amount: number | string): string {
  return formatCurrency(amount, "RUB", "ru");
}

export function formatPercent(
  value: number,
  locale: AppLocale = "ru",
  digits = 0,
): string {
  return `${value.toLocaleString(bcp47(locale), {
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

export function formatDate(
  date: Date | string,
  locale: AppLocale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(bcp47(locale), options);
}
