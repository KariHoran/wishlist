"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";

type NotificationRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
  text: string;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.notifications ?? []);
    setLoading(false);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
  }, []);

  useEffect(() => {
    load();
    const es = new EventSource("/api/notifications/events");
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "notification") load();
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [load]);

  return (
    <div className="page-frame grid-bg">
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-6 md:px-8">
        <Link
          href="/dashboard"
          className="pixel-font text-xs underline underline-offset-4 leading-normal"
        >
          ← Назад
        </Link>
        <h1 className="display-font mt-4 mb-6 text-2xl">Уведомления</h1>
        {loading && <p className="mono-font text-lg">...</p>}
        {!loading && items.length === 0 && (
          <p className="mono-font text-xl text-[#666]">Пока пусто</p>
        )}
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id} className="hard-border bg-white p-4">
              <p className="mono-font text-lg leading-snug">{n.text}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="mono-font text-sm text-[#999]">
                  {new Date(n.createdAt).toLocaleString("ru-RU")}
                </span>
                {n.type === "ITEM_CANCELLED_REFUND_DUE" && (
                  <span
                    className={`pixel-font text-[9px] ${
                      n.payload.refunded === true ? "text-green-700" : "text-[#c44]"
                    }`}
                  >
                    {n.payload.refunded === true ? "Возвращено" : "Ожидает возврата"}
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
