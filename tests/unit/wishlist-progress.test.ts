import { describe, expect, it } from "vitest";
import {
  calcCollectedPercent,
  isItemFundingFulfilled,
  wishlistProgress,
} from "@/lib/wishlist-progress";

describe("wishlist progress", () => {
  it("returns zeros for empty list", () => {
    const p = wishlistProgress([]);
    expect(p.total).toBe(0);
    expect(p.percent).toBe(0);
    expect(p.isFulfilled).toBe(false);
  });

  it("ignores CANCELLED items", () => {
    const p = wishlistProgress([
      { status: "CANCELLED" },
      { status: "AVAILABLE" },
      { status: "RESERVED" },
    ]);
    expect(p.total).toBe(2);
    expect(p.collected).toBe(1);
    expect(p.percent).toBe(50);
  });

  it("isFulfilled when all active items reserved or funding", () => {
    expect(
      wishlistProgress([
        { status: "RESERVED" },
        { status: "FUNDING" },
      ]).isFulfilled,
    ).toBe(true);
    expect(
      wishlistProgress([
        { status: "RESERVED" },
        { status: "AVAILABLE" },
      ]).isFulfilled,
    ).toBe(false);
  });

  it("calcCollectedPercent caps at 100", () => {
    expect(calcCollectedPercent(500, 400)).toBe(100);
    expect(calcCollectedPercent(0, 100)).toBe(0);
  });

  it("isItemFundingFulfilled", () => {
    expect(isItemFundingFulfilled(900, 900)).toBe(true);
    expect(isItemFundingFulfilled(899, 900)).toBe(false);
  });
});
