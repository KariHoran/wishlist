import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { Duration } from "@upstash/ratelimit";
import { LOCALE_COOKIE, defaultLocale, parseLocale } from "@/i18n/config";
import { loadMessagesSync } from "@/i18n/load-messages";

type Bucket = { count: number; resetAt: number };

export const RATE_LIMIT_ERROR_KEY = "tooManyAttempts";

const memoryBuckets = new Map<string, Bucket>();

function parseWindow(windowMs: number): Duration {
  if (windowMs % (60 * 60 * 1000) === 0) {
    return `${windowMs / (60 * 60 * 1000)} h` as Duration;
  }
  if (windowMs % (60 * 1000) === 0) {
    return `${windowMs / (60 * 1000)} m` as Duration;
  }
  return `${Math.max(1, Math.floor(windowMs / 1000))} s` as Duration;
}

function memoryLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = memoryBuckets.get(key);

  if (!entry || now >= entry.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, reset: now + windowMs };
  }

  if (entry.count >= limit) {
    return { success: false, reset: entry.resetAt };
  }

  entry.count += 1;
  memoryBuckets.set(key, entry);
  return { success: true, reset: entry.resetAt };
}

type LimitConfig = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
};

export type LimitResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      errorKey: string;
      retryAfterSeconds: number;
      body: { error: string };
    };

async function rateLimitErrorText(): Promise<string> {
  let locale = defaultLocale;
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    locale = parseLocale(store.get(LOCALE_COOKIE)?.value ?? defaultLocale);
  } catch {
    // tests / cron have no request cookies
  }
  const messages = loadMessagesSync(locale) as { errors?: Record<string, string> };
  return messages.errors?.[RATE_LIMIT_ERROR_KEY] ?? RATE_LIMIT_ERROR_KEY;
}

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

const ratelimitCache = new Map<string, Ratelimit>();

function getRatelimit(config: LimitConfig) {
  const cacheKey = `${config.keyPrefix}:${config.limit}:${config.windowMs}`;
  const existing = ratelimitCache.get(cacheKey);
  if (existing) return existing;

  const limiter = new Ratelimit({
    redis: redis!,
    limiter: Ratelimit.slidingWindow(config.limit, parseWindow(config.windowMs)),
    prefix: `wishlist:${config.keyPrefix}`,
  });
  ratelimitCache.set(cacheKey, limiter);
  return limiter;
}

export async function enforceRateLimit(config: LimitConfig, subject: string): Promise<LimitResult> {
  const key = `${config.keyPrefix}:${subject}`;

  if (!redis) {
    const result = memoryLimit(key, config.limit, config.windowMs);
    if (result.success) return { ok: true };
    return {
      ok: false,
      status: 429,
      errorKey: RATE_LIMIT_ERROR_KEY,
      retryAfterSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
      body: { error: await rateLimitErrorText() },
    };
  }

  const result = await getRatelimit(config).limit(subject);
  if (result.success) return { ok: true };
  return {
    ok: false,
    status: 429,
    errorKey: RATE_LIMIT_ERROR_KEY,
    retryAfterSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
    body: { error: await rateLimitErrorText() },
  };
}

export const RATE_LIMITS = {
  auth: { keyPrefix: "auth", limit: 5, windowMs: 5 * 60 * 1000 },
  authIp: { keyPrefix: "auth-ip", limit: 40, windowMs: 5 * 60 * 1000 },
  reserveOrContribute: {
    keyPrefix: "item-action",
    limit: 20,
    windowMs: 60 * 1000,
  },
  friendRequest: { keyPrefix: "friend-request", limit: 10, windowMs: 60 * 60 * 1000 },
  avatarUpload: { keyPrefix: "avatar-upload", limit: 5, windowMs: 60 * 60 * 1000 },
} as const;

export function getRequestIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export function __resetRateLimitMemoryForTests() {
  memoryBuckets.clear();
}
