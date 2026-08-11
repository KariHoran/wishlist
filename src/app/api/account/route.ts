import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const avatarUrl =
    body.avatarUrl === null || body.avatarUrl === undefined
      ? undefined
      : String(body.avatarUrl);

  // Data-URL avatars bloat the Auth.js JWT (chunked into 70+ Set-Cookie headers)
  // and break login with net::ERR_HTTP2_PROTOCOL_ERROR. Cap size hard.
  if (avatarUrl && avatarUrl.startsWith("data:") && avatarUrl.length > 32_000) {
    return NextResponse.json(
      { error: "Аватар слишком большой — выберите файл до ~20 КБ" },
      { status: 400 },
    );
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
