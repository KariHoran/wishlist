type FinancialActivityItem = {
  status: string;
  reservedById?: string | null;
  amountCollected?: unknown;
  contributorCount?: number;
  contributions?: readonly unknown[];
};

function contributionIsOpen(contribution: unknown): boolean {
  if (contribution && typeof contribution === "object" && "refunded" in contribution) {
    return !(contribution as { refunded?: boolean }).refunded;
  }
  return Boolean(contribution);
}

export function wishlistHasFinancialActivity(
  items: FinancialActivityItem[],
): boolean {
  return items.some(
    (item) =>
      item.status === "RESERVED" ||
      item.status === "FUNDING" ||
      item.reservedById != null ||
      Number(item.amountCollected) > 0 ||
      (item.contributorCount ?? 0) > 0 ||
      (item.contributions?.some(contributionIsOpen) ?? false),
  );
}
