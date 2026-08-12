import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  validateContribute,
  validateReserve,
  validateStartFunding,
  validateUnreserve,
  statusAfterStopFunding,
} from "@/lib/item-status";

describe("item status transitions", () => {
  it("allows AVAILABLE → RESERVED", () => {
    expect(canTransition("AVAILABLE", "RESERVED")).toBe(true);
    const r = validateReserve({ status: "AVAILABLE" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.nextStatus).toBe("RESERVED");
  });

  it("allows AVAILABLE → FUNDING", () => {
    expect(canTransition("AVAILABLE", "FUNDING")).toBe(true);
    const r = validateStartFunding({ status: "AVAILABLE" });
    expect(r.ok).toBe(true);
  });

  it("allows FUNDING → CANCELLED", () => {
    expect(canTransition("FUNDING", "CANCELLED")).toBe(true);
    const r = assertTransition("FUNDING", "CANCELLED");
    expect(r.ok).toBe(true);
  });

  it("rejects double reserve on RESERVED item", () => {
    const r = validateReserve({ status: "RESERVED" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("забронирован");
      expect(r.statusCode).toBe(409);
    }
  });

  it("rejects reserve while funding with money collected", () => {
    const r = validateReserve({
      status: "FUNDING",
      amountCollected: 100,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.statusCode).toBe(409);
  });

  it("rejects start_funding on RESERVED item", () => {
    const r = validateStartFunding({ status: "RESERVED" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.statusCode).toBe(409);
  });

  it("rejects contribute on RESERVED item", () => {
    const r = validateContribute({ status: "RESERVED" });
    expect(r.ok).toBe(false);
  });

  it("validates unreserve ownership", () => {
    expect(validateUnreserve({ status: "RESERVED", reservedById: "u1" }, "u2").ok).toBe(
      false,
    );
    expect(
      validateUnreserve({ status: "RESERVED", reservedById: "u1" }, "u1").ok,
    ).toBe(true);
  });

  it("stop_funding status depends on collected amount", () => {
    expect(statusAfterStopFunding(0)).toBe("AVAILABLE");
    expect(statusAfterStopFunding(50)).toBe("FUNDING");
  });

  it("CANCELLED has no outgoing transitions", () => {
    expect(canTransition("CANCELLED", "AVAILABLE")).toBe(false);
    expect(validateReserve({ status: "CANCELLED" }).ok).toBe(false);
  });
});
