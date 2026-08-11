"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type NotificationRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
  text: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setUnreadCount(data.unreadCount ?? 0);
    setItems(data.notifications ?? []);
  }, []);

  useEffect(() => {
    load();
    const es = new EventSource("/api/notifications/events");
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "notification") {
          load();
        }
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [load]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await load();
      setLoading(false);
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setUnreadCount(0);
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  }

  function refundStatus(n: NotificationRow) {
    if (n.type !== "ITEM_CANCELLED_REFUND_DUE") return null;
    const refunded = n.payload.refunded === true;
    return (
      <span
        className={`pixel-font text-[9px] ${refunded ? "text-green-700" : "text-[#c44]"}`}
      >
        {refunded ? "Возвращено" : "Ожидает возврата"}
      </span>
    );
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={toggleOpen}
        className="hard-border relative flex h-10 w-10 items-center justify-center bg-white"
        aria-label="Уведомления"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/decor/envelope.svg" alt="" className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-black bg-[#ffb6c8] px-1 text-[10px] font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-12 right-0 z-50 w-[min(320px,calc(100vw-2rem))] border-3 border-black bg-white shadow-[4px_4px_0_#000]">
          <div className="border-b-2 border-black px-3 py-2">
            <p className="pixel-font text-xs">Уведомления</p>
          </div>
          <div className="max-h-80 overflow-y-auto no-scrollbar">
            {loading && (
              <p className="mono-font p-4 text-center text-base text-[#888]">...</p>
            )}
            {!loading && items.length === 0 && (
              <p className="mono-font p-4 text-center text-base text-[#888]">
                Пока пусто
              </p>
            )}
            {!loading &&
              items.map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-[#ddd] px-3 py-3 ${!n.isRead ? "bg-[#fff8fb]" : ""}`}
                >
                  <p className="mono-font text-base leading-snug">{n.text}</p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <span className="mono-font text-sm text-[#999]">
                      {new Date(n.createdAt).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {refundStatus(n)}
                  </div>
                </div>
              ))}
          </div>
          <div className="border-t-2 border-black p-2 md:hidden">
            <Link
              href="/notifications"
              className="pixel-font block text-center text-[10px] underline"
              onClick={() => setOpen(false)}
            >
              Все уведомления
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
