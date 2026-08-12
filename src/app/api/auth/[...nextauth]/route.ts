import { handlers } from "@/lib/auth";
import { NextResponse } from "next/server";
import { enforceRateLimit, getRequestIp, RATE_LIMITS } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

export const { GET } = handlers;

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const isCredentialsAttempt = url.pathname.includes("/callback/credentials");

  if (isCredentialsAttempt) {
    const limit = await enforceRateLimit(RATE_LIMITS.auth, getRequestIp(req));
    if (!limit.ok) {
      return NextResponse.json(limit.body, {
        status: limit.status,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      });
    }
  }

  return handlers.POST(req);
}
