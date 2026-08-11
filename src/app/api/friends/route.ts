import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  if (friend.id === session.user.id) {
    return NextResponse.json({ error: "Нельзя добавить себя" }, { status: 400 });
  }

  const [a, b] =
    session.user.id < friend.id
      ? [session.user.id, friend.id]
      : [friend.id, session.user.id];

  const existing = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId: a, userBId: b } },
  });
  if (existing) {
    return NextResponse.json({ error: "Уже в друзьях" }, { status: 409 });
  }

  await prisma.friendship.create({
    data: { userAId: a, userBId: b },
  });

  return NextResponse.json({ ok: true });
}
