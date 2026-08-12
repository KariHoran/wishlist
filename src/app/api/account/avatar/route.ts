import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = await enforceRateLimit(RATE_LIMITS.avatarUpload, session.user.id);
  if (!limit.ok) {
    return NextResponse.json(limit.body, {
      status: limit.status,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Можно загрузить только изображение" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Файл слишком большой, попробуйте другое фото" },
      { status: 400 },
    );
  }

  try {
    const blob = await put(
      `avatars/${session.user.id}-${Date.now()}.jpg`,
      file,
      {
        access: "public",
        contentType: file.type || "image/jpeg",
        addRandomSuffix: true,
      },
    );
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("[avatar] upload failed", err);
    return NextResponse.json(
      { error: "Не удалось загрузить аватар" },
      { status: 500 },
    );
  }
}
