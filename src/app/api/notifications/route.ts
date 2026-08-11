import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNotificationText } from "@/lib/notifications";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({
      where: { userId: session.user.id, isRead: false },
    }),
  ]);

  return NextResponse.json({
    unreadCount,
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      payload: n.payload,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
      text: formatNotificationText(
        n.type,
        n.payload as Parameters<typeof formatNotificationText>[1],
      ),
    })),
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const markAll = body.markAll === true;
  const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];

  if (markAll) {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data: { isRead: true },
    });
  } else if (ids.length > 0) {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, id: { in: ids } },
      data: { isRead: true },
    });
  }

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, isRead: false },
  });

  return NextResponse.json({ ok: true, unreadCount });
}
