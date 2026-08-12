"use client";

import { RetroStatePage } from "@/components/RetroState";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
