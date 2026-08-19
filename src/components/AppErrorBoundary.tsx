"use client";

import * as Sentry from "@sentry/nextjs";
import { useTranslations } from "next-intl";
import { RetroStatePage } from "@/components/RetroState";

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  const t = useTranslations("empty");
  const tCommon = useTranslations("common");

  return (
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => (
        <RetroStatePage
          variant="error"
          message={t("serverError")}
          actionLabel={tCommon("tryAgain")}
          onAction={resetError}
        />
      )}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
