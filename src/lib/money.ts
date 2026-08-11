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

export function calcCollectedPercent(collected: number, price: number): number {
  if (price <= 0) return 0;
  return Math.min(100, (collected / price) * 100);
}

export function wishlistProgress(items: { status: string }[]) {
  const total = items.length;
  const done = items.filter(
    (i) => i.status === "RESERVED" || i.status === "FUNDING",
  ).length;
  // "собрано" in mockups = reserved or fully funded items ratio for wishlist-level bar
  const collected = items.filter((i) => i.status === "RESERVED").length;
  const percent = total === 0 ? 0 : Math.round((collected / total) * 100);
  return { total, collected, percent, done };
}

export function itemFundingPercent(
  amountCollected: number | string,
  price: number | string,
): number {
  return calcCollectedPercent(Number(amountCollected), Number(price));
}
