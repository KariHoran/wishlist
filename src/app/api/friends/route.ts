import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import {
  friendshipPair,
  validateFriendRequestSend,
} from "@/lib/friend-requests";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { jsonError, translateErrorKey } from "@/lib/api-response";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("unauthorized", 401);
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
    return jsonError("unauthorized", 401);
  }
  const me = session.user.id;
  Sentry.setUser({ id: me });
  Sentry.setTag("route", "friends_request");
  const limit = await enforceRateLimit(RATE_LIMITS.friendRequest, me);
  if (!limit.ok) {
    const res = await jsonError(limit.errorKey, limit.status);
    res.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return res;
  }

  const body = await req.json();
  const handle = String(body.handle ?? "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  if (!handle) {
    return jsonError("handleRequired", 400);
  }

  const friend = await prisma.user.findUnique({ where: { handle } });
  if (!friend) {
    return jsonError("userNotFound", 404);
  }
  if (friend.id === me) {
    return jsonError("cannotAddSelf", 400);
  }
  Sentry.setTag("friendId", friend.id);

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
    return translateErrorKey(
      validation,
      validation.statusCode,
      validation.needsAccept
        ? {
            needsAccept: true,
            requestId: validation.requestId,
            from: {
              id: friend.id,
              displayName: friend.displayName,
              handle: friend.handle,
            },
          }
        : undefined,
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
      return jsonError("requestAlreadySent", 409);
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
    actorName: meUser?.displayName,
    actorHandle: meUser?.handle,
    requestId: request.id,
  });

  return NextResponse.json({ ok: true, requestId: request.id });
}
