export type FriendRequestValidation =
  | { ok: true }
  | {
      ok: false;
      errorKey: string;
      statusCode: number;
      needsAccept?: boolean;
      requestId?: string;
    };

export function friendshipPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function validateFriendRequestSend(params: {
  meId: string;
  friendId: string;
  alreadyFriends: boolean;
  incomingPending: { id: string } | null;
  outgoingPending: { id: string } | null;
}): FriendRequestValidation {
  const { meId, friendId, alreadyFriends, incomingPending, outgoingPending } =
    params;

  if (friendId === meId) {
    return { ok: false, errorKey: "cannotAddSelf", statusCode: 400 };
  }
  if (alreadyFriends) {
    return { ok: false, errorKey: "alreadyFriends", statusCode: 409 };
  }
  if (incomingPending) {
    return {
      ok: false,
      errorKey: "incomingPending",
      statusCode: 409,
      needsAccept: true,
      requestId: incomingPending.id,
    };
  }
  if (outgoingPending) {
    return { ok: false, errorKey: "requestAlreadySent", statusCode: 409 };
  }
  return { ok: true };
}
