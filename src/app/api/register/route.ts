import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, slugifyHandle } from "@/lib/password";
import { enforceRateLimit, getRequestIp, RATE_LIMITS } from "@/lib/rate-limit";
import { captureRouteError } from "@/lib/sentry-report";

export async function POST(req: Request) {
  try {
    const limit = await enforceRateLimit(RATE_LIMITS.auth, getRequestIp(req));
    if (!limit.ok) {
      return NextResponse.json(limit.body, {
        status: limit.status,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      });
    }

    const body = await req.json();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");
    const passwordConfirm = String(body.passwordConfirm ?? "");
    const displayName = String(body.displayName ?? "").trim() || email.split("@")[0];

    if (!email || !password) {
      return NextResponse.json({ error: "Заполните email и пароль" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Пароль должен быть не короче 6 символов" },
        { status: 400 },
      );
    }
    if (password !== passwordConfirm) {
      return NextResponse.json({ error: "Пароли не совпадают" }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "Email уже зарегистрирован" }, { status: 409 });
    }

    let handle = slugifyHandle(displayName) || `user${Date.now().toString(36)}`;
    const handleTaken = await prisma.user.findUnique({ where: { handle } });
    if (handleTaken) handle = `${handle}${Math.floor(Math.random() * 999)}`;

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, displayName, handle },
      select: { id: true, email: true, handle: true },
    });

    return NextResponse.json({ ok: true, user });
  } catch (e) {
    captureRouteError(e, {
      tags: { route: "register" },
      contextKey: "register",
    });
    console.error(e);
    return NextResponse.json({ error: "Ошибка регистрации" }, { status: 500 });
  }
}
