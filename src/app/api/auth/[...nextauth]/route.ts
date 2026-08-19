import { handlers } from "@/lib/auth";
import { NextResponse } from "next/server";
import { enforceRateLimit, getRequestIp, RATE_LIMITS } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api-response";
import type { NextRequest } from "next/server";

export const { GET } = handlers;

async function credentialsEmail(req: NextRequest): Promise<string> {
  try {
    const cloned = req.clone();
    const contentType = cloned.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await cloned.json()) as { email?: string };
      return String(body.email ?? "").trim().toLowerCase();
    }
    const form = await cloned.formData();
    return String(form.get("email") ?? "").trim().toLowerCase();
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const isCredentialsAttempt = url.pathname.includes("/callback/credentials");

  if (isCredentialsAttempt) {
    const ip = getRequestIp(req);
    const email = await credentialsEmail(req);
    const ipLimit = await enforceRateLimit(RATE_LIMITS.authIp, ip);
    if (!ipLimit.ok) {
      const res = await jsonError(ipLimit.errorKey, ipLimit.status);
      res.headers.set("Retry-After", String(ipLimit.retryAfterSeconds));
      return res;
    }
    const accountLimit = await enforceRateLimit(
      RATE_LIMITS.auth,
      `${ip}:${email || "unknown"}`,
    );
    if (!accountLimit.ok) {
      const res = await jsonError(accountLimit.errorKey, accountLimit.status);
      res.headers.set("Retry-After", String(accountLimit.retryAfterSeconds));
      return res;
    }
  }

  return handlers.POST(req);
}
