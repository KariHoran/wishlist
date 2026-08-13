import type { ErrorEvent, EventHint } from "@sentry/core";

/** Prefer public DSN so the same value works in client + server bundles. */
export const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;

/** 100% in dev; ~15% in prod to stay within free-tier span quotas. */
export const tracesSampleRate =
  process.env.NODE_ENV === "development" ? 1.0 : 0.15;

const NOISE_PATTERNS = [
  /message port closed/i,
  /ResizeObserver loop/i,
  /Loading CSS chunk/i,
  /ChunkLoadError/i,
  /Non-Error promise rejection captured/i,
];

function eventText(event: ErrorEvent, hint: EventHint): string {
  const original = hint.originalException;
  const fromHint =
    typeof original === "string"
      ? original
      : original instanceof Error
        ? original.message
        : "";
  const fromValues =
    event.exception?.values?.map((v) => v.value ?? "").join(" ") ?? "";
  return `${event.message ?? ""} ${fromHint} ${fromValues}`;
}

/** Drop known-harmless browser / extension noise before it hits Sentry. */
export function beforeSend(
  event: ErrorEvent,
  hint: EventHint,
): ErrorEvent | null {
  const haystack = eventText(event, hint);
  if (NOISE_PATTERNS.some((re) => re.test(haystack))) {
    return null;
  }

  const frames =
    event.exception?.values?.flatMap((v) => v.stacktrace?.frames ?? []) ?? [];
  if (
    frames.some(
      (f) =>
        f.filename?.includes("chrome-extension://") ||
        f.filename?.includes("moz-extension://") ||
        f.filename?.includes("safari-extension://"),
    )
  ) {
    return null;
  }

  return event;
}
