import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetRateLimitMemoryForTests,
  enforceRateLimit,
} from "@/lib/rate-limit";

describe("rate limiter (memory fallback)", () => {
  beforeEach(() => {
    __resetRateLimitMemoryForTests();
  });

  it("blocks requests after exceeding the limit", async () => {
    const config = {
      keyPrefix: "test-auth",
      limit: 5,
      windowMs: 5 * 60 * 1000,
    };

    for (let i = 0; i < 5; i += 1) {
      const r = await enforceRateLimit(config, "ip:1.2.3.4");
      expect(r.ok).toBe(true);
    }

    const blocked = await enforceRateLimit(config, "ip:1.2.3.4");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.status).toBe(429);
      expect(blocked.errorKey).toBe("tooManyAttempts");
      expect(blocked.body.error).toBeTruthy();
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });
});
