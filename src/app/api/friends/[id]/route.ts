import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

type Props = { params: Promise<{ id: string }> };

function friendshipPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Accept / decline / cancel a friend request */
export async function PATCH(req: Request, { params }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const me = session.user.id;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  const request = await prisma.friendRequest.findUnique({
    where: { id },
    include: {
      from: { select: { id: true, displayName: true, handle: true } },
      to: { select: { id: true, displayName: true, handle: true } },
    },
  });
  if (!request) {
    return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
  }
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "Заявка уже обработана" }, { status: 409 });
  }

  if (action === "accept") {
    if (request.toId !== me) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const [a, b] = friendshipPair(request.fromId, request.toId);
    await prisma.$transaction([
      prisma.friendRequest.update({
        where: { id },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      }),
      prisma.friendship.upsert({
        where: { userAId_userBId: { userAId: a, userBId: b } },
        create: { userAId: a, userBId: b },
        update: {},
      }),
    ]);

    const meUser = await prisma.user.findUnique({
      where: { id: me },
      select: { displayName: true, handle: true },
    });
    await createNotification(request.fromId, "FRIEND_REQUEST_ACCEPTED", {
      actorName: meUser?.displayName ?? "Кто-то",
      actorHandle: meUser?.handle,
      requestId: request.id,
    });

    return NextResponse.json({ ok: true, status: "ACCEPTED" });
  }

  if (action === "decline") {
    if (request.toId !== me) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.friendRequest.update({
      where: { id },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    return NextResponse.json({ ok: true, status: "DECLINED" });
  }

  if (action === "cancel") {
    if (request.fromId !== me) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.friendRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true, status: "CANCELLED" });
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}

/** Remove friendship by the other user's id (bidirectional). */
export async function DELETE(_req: Request, { params }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const me = session.user.id;
  const { id: friendId } = await params;
  if (!friendId || friendId === me) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const [a, b] = friendshipPair(me, friendId);
  const friendship = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId: a, userBId: b } },
  });
  if (!friendship) {
    return NextResponse.json({ error: "Дружба не найдена" }, { status: 404 });
  }

  // Drop friendship + any FriendRequest rows both ways so a new request can be sent cleanly
  await prisma.$transaction([
    prisma.friendship.delete({ where: { id: friendship.id } }),
    prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { fromId: me, toId: friendId },
          { fromId: friendId, toId: me },
        ],
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
