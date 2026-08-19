"use client";

import { useEffect, useMemo } from "react";
import * as Sentry from "@sentry/nextjs";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { RetroStatePage } from "@/components/RetroState";
import { LOCALE_COOKIE, defaultLocale, parseLocale, type AppLocale } from "@/i18n/config";
import { loadMessagesSync } from "@/i18n/load-messages";

function getLocaleFromCookie(): AppLocale {
  if (typeof document === "undefined") return defaultLocale;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  return parseLocale(match?.[1]);
}

function GlobalErrorContent({ reset }: { reset: () => void }) {
  const t = useTranslations("empty");
  const tCommon = useTranslations("common");

  return (
    <RetroStatePage
      title={t("serverErrorTitle")}
      variant="error"
      message={t("serverError")}
      actionLabel={tCommon("tryAgain")}
      onAction={reset}
    />
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useMemo(() => getLocaleFromCookie(), []);
  const messages = useMemo(() => loadMessagesSync(locale), [locale]);

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <GlobalErrorContent reset={reset} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
