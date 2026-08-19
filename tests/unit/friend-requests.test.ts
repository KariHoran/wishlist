import { describe, expect, it } from "vitest";
import { validateFriendRequestSend } from "@/lib/friend-requests";

describe("friend request validation", () => {
  const base = {
    meId: "user-a",
    friendId: "user-b",
    alreadyFriends: false,
    incomingPending: null,
    outgoingPending: null,
  };

  it("rejects adding yourself", () => {
    const r = validateFriendRequestSend({ ...base, friendId: "user-a" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errorKey).toBe("cannotAddSelf");
      expect(r.statusCode).toBe(400);
    }
  });

  it("rejects duplicate outgoing request", () => {
    const r = validateFriendRequestSend({
      ...base,
      outgoingPending: { id: "req-1" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.statusCode).toBe(409);
  });

  it("rejects when already friends", () => {
    const r = validateFriendRequestSend({ ...base, alreadyFriends: true });
    expect(r.ok).toBe(false);
  });

  it("allows new request", () => {
    expect(validateFriendRequestSend(base).ok).toBe(true);
  });
});
