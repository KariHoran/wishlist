import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isAllowedAvatarUrl(value: string): boolean {
  if (value.startsWith("/decor/")) return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname.endsWith(".public.blob.vercel-storage.com") ||
        url.hostname === "public.blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const displayName = String(body.displayName ?? "").trim();
  if (!displayName) {
    return NextResponse.json({ error: "Укажите имя" }, { status: 400 });
  }

  let avatarUrl: string | undefined;
  if (body.avatarUrl === null) {
    avatarUrl = "/decor/avatar-cat.svg";
  } else if (body.avatarUrl !== undefined) {
    const value = String(body.avatarUrl);
    // Never persist base64 data URLs in Postgres — they bloat JWT cookies.
    if (value.startsWith("data:")) {
      return NextResponse.json(
        { error: "Загрузите фото заново — старый формат больше не поддерживается" },
        { status: 400 },
      );
    }
    if (!isAllowedAvatarUrl(value)) {
      return NextResponse.json({ error: "Некорректный URL аватара" }, { status: 400 });
    }
    avatarUrl = value;
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      displayName,
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl },
  });
}
