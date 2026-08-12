import { describe, expect, it, vi } from "vitest";
import { authenticateCredentials } from "@/lib/credentials-auth";

describe("authenticateCredentials", () => {
  it("returns null for wrong password", async () => {
    const result = await authenticateCredentials(
      "test@example.com",
      "wrong",
      {
        findUserByEmail: async () => ({
          id: "1",
          email: "test@example.com",
          displayName: "Test",
          avatarUrl: null,
          handle: "test",
          passwordHash: "hash",
        }),
        verifyPassword: async () => false,
      },
    );
    expect(result).toBeNull();
  });

  it("returns null for unknown email", async () => {
    const result = await authenticateCredentials("missing@example.com", "pass", {
      findUserByEmail: async () => null,
      verifyPassword: async () => true,
    });
    expect(result).toBeNull();
  });

  it("returns user on valid credentials", async () => {
    const result = await authenticateCredentials("test@example.com", "secret", {
      findUserByEmail: async () => ({
        id: "u1",
        email: "test@example.com",
        displayName: "Tester",
        avatarUrl: null,
        handle: "tester",
        passwordHash: "hash",
      }),
      verifyPassword: async (p) => p === "secret",
    });
    expect(result).toMatchObject({
      id: "u1",
      email: "test@example.com",
      name: "Tester",
    });
  });

  it("does not call verifyPassword when user missing", async () => {
    const verify = vi.fn(async () => true);
    await authenticateCredentials("x@y.com", "pass", {
      findUserByEmail: async () => null,
      verifyPassword: verify,
    });
    expect(verify).not.toHaveBeenCalled();
  });
});
