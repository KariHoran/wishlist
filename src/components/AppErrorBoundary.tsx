"use client";

import * as Sentry from "@sentry/nextjs";
import { RetroStatePage } from "@/components/RetroState";

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => (
        <RetroStatePage
          variant="error"
          message="Упс! что-то пошло не так"
          actionLabel="Попробовать снова"
          onAction={resetError}
        />
      )}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
