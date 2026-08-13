import * as Sentry from "@sentry/nextjs";

/** Capture a handled route error with useful tags/context (no PII). */
export function captureRouteError(
  error: unknown,
  options: {
    userId?: string | null;
    tags?: Record<string, string>;
    context?: Record<string, unknown>;
    contextKey?: string;
  } = {},
): void {
  Sentry.withScope((scope) => {
    if (options.userId) {
      scope.setUser({ id: options.userId });
    }
    if (options.tags) {
      for (const [key, value] of Object.entries(options.tags)) {
        scope.setTag(key, value);
      }
    }
    if (options.context) {
      scope.setContext(options.contextKey ?? "route", options.context);
    }
    Sentry.captureException(error);
  });
}
