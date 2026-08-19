"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useTranslations } from "next-intl";
import { RetroStatePage } from "@/components/RetroState";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("empty");
  const tCommon = useTranslations("common");

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

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
