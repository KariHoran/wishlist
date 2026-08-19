"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { NotificationType } from "@prisma/client";
import { Navbar } from "@/components/Navbar";
import { RetroInlineState, RetroStatePage } from "@/components/RetroState";
import { type AppLocale } from "@/i18n/config";
import { formatDate } from "@/lib/money";
import {
  formatNotificationText,
  type NotificationPayload,
} from "@/lib/notification-text";

type NotificationRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const tEmpty = useTranslations("empty");
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) {
      setLoadError(t("loadFailed"));
      setLoading(false);
      return;
    }
    const data = await res.json();
    setItems(data.notifications ?? []);
    setLoadError(null);
    setLoading(false);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const es = new EventSource("/api/notifications/events");
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "notification") load();
      } catch {
        /* ignore */
      }
    };
    return () => {
      window.clearTimeout(timer);
      es.close();
    };
  }, [load]);

  if (loadError) {
    return (
      <RetroStatePage
        title={tEmpty("serverErrorTitle")}
        variant="error"
        message={loadError}
        actionLabel={tCommon("tryAgain")}
        onAction={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="page-frame grid-bg">
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-6 md:px-8">
        <Link
          href="/dashboard"
          className="pixel-font text-xs underline underline-offset-4 leading-normal"
        >
          {t("back")}
        </Link>
        <h1 className="display-font mt-4 mb-6 text-2xl">{t("title")}</h1>
        {loading && <p className="mono-font text-lg">{tCommon("loading")}</p>}
        {!loading && items.length === 0 && (
          <RetroInlineState title={t("emptyPageTitle")} message={t("emptyPageMessage")} />
        )}
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id} className="hard-border bg-white p-4">
              <p className="mono-font text-lg leading-snug">
                {formatNotificationText(
                  n.type as NotificationType,
                  n.payload as NotificationPayload,
                  locale,
                )}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="mono-font text-sm text-[#999]">
                  {formatDate(n.createdAt, locale)}
                </span>
                {n.type === "ITEM_CANCELLED_REFUND_DUE" && (
                  <span
                    className={`pixel-font text-[9px] ${
                      n.payload.refunded === true ? "text-green-700" : "text-[#c44]"
                    }`}
                  >
                    {n.payload.refunded === true ? t("refunded") : t("refundPending")}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
