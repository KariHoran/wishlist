"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { locales, type AppLocale } from "@/i18n/config";

export function LocaleSwitcher() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("language");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function switchTo(next: AppLocale) {
    if (next === locale || pending) return;
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div
      className="pixel-font flex items-center gap-1 text-[10px] leading-none sm:text-xs"
      aria-label={t("switchTo", { code: locale.toUpperCase() })}
    >
      {locales.map((code, i) => (
        <span key={code} className="flex items-center gap-1">
          {i > 0 ? (
            <span className="text-[#aaa]" aria-hidden>
              {t("separator")}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => switchTo(code)}
            disabled={pending}
            className={
              code === locale
                ? "underline underline-offset-2"
                : "text-[#777] hover:text-black hover:underline hover:underline-offset-2"
            }
          >
            {t(code)}
          </button>
        </span>
      ))}
    </div>
  );
}
