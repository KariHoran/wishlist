import { describe, expect, it } from "vitest";
import {
  amountForSplitIndex,
  canJoinFixedSplit,
  computeSplitBreakdown,
  computeSplitPerPerson,
  shouldCloseFixedSplit,
} from "@/lib/split-calculator";

describe("split calculator", () => {
  it("computes ceil(price/N) per person", () => {
    expect(computeSplitPerPerson(900, 3)).toBe(300);
    expect(computeSplitPerPerson(1000, 3)).toBe(334);
  });

  it("distributes remainder to last participant (1000₽ / 3)", () => {
    const breakdown = computeSplitBreakdown(1000, 3);
    expect(breakdown.amounts).toEqual([334, 334, 332]);
    expect(breakdown.total).toBe(1000);
  });

  it("even split when price divides evenly", () => {
    const breakdown = computeSplitBreakdown(900, 3);
    expect(breakdown.amounts).toEqual([300, 300, 300]);
    expect(breakdown.total).toBe(900);
  });

  it("amountForSplitIndex returns 0 for invalid index", () => {
    expect(amountForSplitIndex(900, 3, -1)).toBe(0);
    expect(amountForSplitIndex(900, 3, 5)).toBe(0);
  });

  it("closes fixed split when participant count reached", () => {
    expect(
      shouldCloseFixedSplit({
        activeContributionCount: 3,
        splitParticipants: 3,
        amountCollected: 900,
        price: 900,
      }),
    ).toBe(true);
  });

  it("closes when money goal reached before headcount", () => {
    expect(
      shouldCloseFixedSplit({
        activeContributionCount: 2,
        splitParticipants: 5,
        amountCollected: 1000,
        price: 1000,
      }),
    ).toBe(true);
  });

  it("does not close when neither goal met", () => {
    expect(
      shouldCloseFixedSplit({
        activeContributionCount: 1,
        splitParticipants: 3,
        amountCollected: 300,
        price: 900,
      }),
    ).toBe(false);
  });

  it("canJoinFixedSplit blocks overflow and duplicates", () => {
    expect(
      canJoinFixedSplit({
        activeContributionCount: 3,
        splitParticipants: 3,
        userAlreadyContributed: false,
      }).ok,
    ).toBe(false);
    expect(
      canJoinFixedSplit({
        activeContributionCount: 1,
        splitParticipants: 3,
        userAlreadyContributed: true,
      }).ok,
    ).toBe(false);
    expect(
      canJoinFixedSplit({
        activeContributionCount: 1,
        splitParticipants: 3,
        userAlreadyContributed: false,
      }).ok,
    ).toBe(true);
  });
});
