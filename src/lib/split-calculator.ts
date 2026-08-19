export type SplitBreakdown = {
  perPerson: number;
  amounts: number[];
  total: number;
};

/** Per-person amount for FIXED_SPLIT (ceil so sum covers price). */
export function computeSplitPerPerson(price: number, participants: number): number {
  if (participants <= 0) return 0;
  return Math.ceil(Number(price) / participants);
}

/** Amount due for participant at 0-based index (last pays the remainder). */
export function amountForSplitIndex(
  price: number,
  participants: number,
  index: number,
): number {
  if (participants <= 0 || index < 0 || index >= participants) return 0;
  const fixed = computeSplitPerPerson(price, participants);
  if (index < participants - 1) return fixed;
  const remainder = Number(price) - fixed * (participants - 1);
  return Math.round(remainder * 100) / 100;
}

/** Full breakdown for N participants — useful for tests and UI previews. */
export function computeSplitBreakdown(
  price: number,
  participants: number,
): SplitBreakdown {
  const amounts = Array.from({ length: participants }, (_, i) =>
    amountForSplitIndex(price, participants, i),
  );
  return {
    perPerson: computeSplitPerPerson(price, participants),
    amounts,
    total: amounts.reduce((a, b) => a + b, 0),
  };
}

/** True when fixed-split collection should close (by headcount or money). */
export function shouldCloseFixedSplit(params: {
  activeContributionCount: number;
  splitParticipants: number;
  amountCollected: number;
  price: number;
}): boolean {
  const { activeContributionCount, splitParticipants, amountCollected, price } =
    params;
  const goalByPeople = activeContributionCount >= splitParticipants;
  const goalByMoney = amountCollected >= price;
  return goalByPeople || goalByMoney;
}

/** Whether another participant can join a fixed split. */
export function canJoinFixedSplit(params: {
  activeContributionCount: number;
  splitParticipants: number;
  userAlreadyContributed: boolean;
}): { ok: true } | { ok: false; errorKey: string; statusCode: number } {
  const { activeContributionCount, splitParticipants, userAlreadyContributed } =
    params;
  if (activeContributionCount >= splitParticipants) {
    return { ok: false, errorKey: "splitFull", statusCode: 409 };
  }
  if (userAlreadyContributed) {
    return {
      ok: false,
      errorKey: "alreadyJoinedSplit",
      statusCode: 409,
    };
  }
  return { ok: true };
}
