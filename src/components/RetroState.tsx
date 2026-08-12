"use client";

import Link from "next/link";
import { DecorImage } from "@/components/DecorImage";

type Variant = "error" | "empty" | "offline";

const variantTitle: Record<Variant, string> = {
  error: "500",
  empty: "Пусто",
  offline: "Оффлайн",
};

export function RetroStatePage({
  title,
  message,
  variant = "error",
  actionLabel,
  actionHref,
  onAction,
}: {
  title?: string;
  message: string;
  variant?: Variant;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div
      className="page-frame relative isolate overflow-hidden text-white"
      style={{
        backgroundImage: "url('/decor/windows-xp-wallpaper.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <DecorImage
        src="/decor/windows-error-stack.png"
        width={280}
        height={170}
        className="top-10 right-6 hidden w-56 opacity-95 md:block lg:w-64"
      />
      <DecorImage
        src="/decor/cat-halftone-sitting.png"
        width={140}
        height={210}
        className="right-6 bottom-4 hidden w-28 rotate-6 opacity-90 md:block"
      />
      <DecorImage
        src="/decor/wolf-halftone-yawn.png"
        width={140}
        height={164}
        className="bottom-4 left-4 hidden w-28 opacity-90 md:block"
      />

      <main className="relative z-10 flex min-h-[calc(100dvh-10px)] flex-col items-center justify-center px-4 text-center">
        <p
          className="display-font text-[64px] leading-none md:text-[110px]"
          style={{ WebkitTextStroke: "4px #000", paintOrder: "stroke fill" }}
        >
          {title ?? variantTitle[variant]}
        </p>
        <p className="pixel-font mt-4 text-sm md:text-base">{message}</p>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="pixel-font mt-5 text-sm underline underline-offset-4"
          >
            {actionLabel}
          </Link>
        ) : null}
        {!actionHref && actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="pixel-font mt-5 text-sm underline underline-offset-4"
          >
            {actionLabel}
          </button>
        ) : null}
      </main>
    </div>
  );
}

export function RetroInlineState({
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`hard-border relative bg-white text-center ${
        compact ? "p-4" : "p-6"
      }`}
    >
      <DecorImage
        src="/decor/cat-halftone-face.png"
        width={72}
        height={78}
        className="-top-7 left-4 hidden w-14 opacity-90 sm:block"
      />
      <p className={`display-font ${compact ? "text-xs" : "text-sm"}`}>
        {title}
      </p>
      <p className={`mono-font mt-2 ${compact ? "text-base" : "text-lg"} text-[#555]`}>
        {message}
      </p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className={`pixel-font mt-4 text-xs underline underline-offset-4 ${
            compact ? "py-1" : ""
          }`}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
