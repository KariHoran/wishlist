"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { RetroStatePage } from "@/components/RetroState";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <RetroStatePage
      title="500"
      variant="error"
      message="Упс! что-то пошло не так"
      actionLabel="Попробовать снова"
      onAction={reset}
    />
  );
}
