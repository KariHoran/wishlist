import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, slugifyHandle } from "@/lib/password";
import { enforceRateLimit, getRequestIp, RATE_LIMITS } from "@/lib/rate-limit";
import { captureRouteError } from "@/lib/sentry-report";
import { jsonError } from "@/lib/api-response";

export async function POST(req: Request) {
  try {
    const limit = await enforceRateLimit(RATE_LIMITS.auth, getRequestIp(req));
    if (!limit.ok) {
      const res = await jsonError(limit.errorKey, limit.status);
      res.headers.set("Retry-After", String(limit.retryAfterSeconds));
      return res;
    }

    const body = await req.json();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");
    const passwordConfirm = String(body.passwordConfirm ?? "");
    const displayName = String(body.displayName ?? "").trim() || email.split("@")[0];

    if (!email || !password) {
      return jsonError("fillEmailPassword", 400);
    }
    if (password.length < 6) {
      return jsonError("passwordTooShort", 400);
    }
    if (password !== passwordConfirm) {
      return jsonError("passwordsMismatch", 400);
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return jsonError("emailTaken", 409);
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
    return jsonError("registerFailed", 500);
  }
}
