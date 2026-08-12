export type FriendRequestValidation =
  | { ok: true }
  | { ok: false; error: string; statusCode: number; needsAccept?: boolean; requestId?: string };

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
    return { ok: false, error: "Нельзя добавить себя", statusCode: 400 };
  }
  if (alreadyFriends) {
    return { ok: false, error: "Уже в друзьях", statusCode: 409 };
  }
  if (incomingPending) {
    return {
      ok: false,
      error: "Пользователь уже отправил вам заявку — примите её",
      statusCode: 409,
      needsAccept: true,
      requestId: incomingPending.id,
    };
  }
  if (outgoingPending) {
    return { ok: false, error: "Заявка уже отправлена", statusCode: 409 };
  }
  return { ok: true };
}
