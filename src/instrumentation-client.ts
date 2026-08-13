import * as Sentry from "@sentry/nextjs";
import {
  SENTRY_DSN,
  beforeSend,
  tracesSampleRate,
} from "@/lib/sentry-options";

Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate,
  beforeSend,
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
