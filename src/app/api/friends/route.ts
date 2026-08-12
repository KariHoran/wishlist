import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import {
  friendshipPair,
  validateFriendRequestSend,
} from "@/lib/friend-requests";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const me = session.user.id;
  const [incoming, outgoing] = await Promise.all([
    prisma.friendRequest.findMany({
      where: { toId: me, status: "PENDING" },
      include: {
        from: {
          select: { id: true, displayName: true, handle: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendRequest.findMany({
      where: { fromId: me, status: "PENDING" },
      include: {
        to: {
          select: { id: true, displayName: true, handle: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ incoming, outgoing });
}

/** Send friend request by handle */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const me = session.user.id;
  const limit = await enforceRateLimit(RATE_LIMITS.friendRequest, me);
  if (!limit.ok) {
    return NextResponse.json(limit.body, {
      status: limit.status,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const body = await req.json();
  const handle = String(body.handle ?? "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  if (!handle) {
    return NextResponse.json({ error: "Укажите ник" }, { status: 400 });
  }

  const friend = await prisma.user.findUnique({ where: { handle } });
  if (!friend) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }
  if (friend.id === me) {
    return NextResponse.json({ error: "Нельзя добавить себя" }, { status: 400 });
  }

  const [a, b] = friendshipPair(me, friend.id);
  const existingFriendship = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId: a, userBId: b } },
  });

  const incoming = await prisma.friendRequest.findFirst({
    where: { fromId: friend.id, toId: me, status: "PENDING" },
  });

  const outgoing = await prisma.friendRequest.findFirst({
    where: { fromId: me, toId: friend.id, status: "PENDING" },
  });

  const validation = validateFriendRequestSend({
    meId: me,
    friendId: friend.id,
    alreadyFriends: Boolean(existingFriendship),
    incomingPending: incoming,
    outgoingPending: outgoing,
  });
  if (!validation.ok) {
    return NextResponse.json(
      {
        error: validation.error,
        ...(validation.needsAccept
          ? {
              needsAccept: true,
              requestId: validation.requestId,
              from: {
                id: friend.id,
                displayName: friend.displayName,
                handle: friend.handle,
              },
            }
          : {}),
      },
      { status: validation.statusCode },
    );
  }

  // Reuse declined/accepted unique pair if exists
  const prior = await prisma.friendRequest.findUnique({
    where: { fromId_toId: { fromId: me, toId: friend.id } },
  });

  const meUser = await prisma.user.findUnique({
    where: { id: me },
    select: { displayName: true, handle: true },
  });

  let request;
  if (prior) {
    if (prior.status === "PENDING") {
      return NextResponse.json({ error: "Заявка уже отправлена" }, { status: 409 });
    }
    request = await prisma.friendRequest.update({
      where: { id: prior.id },
      data: { status: "PENDING", respondedAt: null, createdAt: new Date() },
    });
  } else {
    request = await prisma.friendRequest.create({
      data: { fromId: me, toId: friend.id },
    });
  }

  await createNotification(friend.id, "FRIEND_REQUEST_RECEIVED", {
    actorName: meUser?.displayName ?? "Кто-то",
    actorHandle: meUser?.handle,
    requestId: request.id,
  });

  return NextResponse.json({ ok: true, requestId: request.id });
}
