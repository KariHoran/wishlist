"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNetwork } from "@/components/NetworkProvider";

type Person = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
};

type Incoming = {
  id: string;
  from: Person;
  createdAt: string;
};

type Outgoing = {
  id: string;
  to: Person;
  createdAt: string;
};

export function FriendRequestsPanel({
  incoming,
  outgoing,
}: {
  incoming: Incoming[];
  outgoing: Outgoing[];
}) {
  const router = useRouter();
  const { online, requireOnline } = useNetwork();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(id: string, action: "accept" | "decline" | "cancel") {
    if (!requireOnline()) return;
    setBusyId(id);
    const res = await fetch(`/api/friends/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Ошибка");
      return;
    }
    router.refresh();
  }

  if (incoming.length === 0 && outgoing.length === 0) return null;

  return (
    <div className="mb-8 space-y-6">
      {incoming.length > 0 && (
        <section>
          <h2 className="pixel-font mb-3 text-sm">Входящие заявки</h2>
          <ul className="space-y-3">
            {incoming.map((r) => (
              <li
                key={r.id}
                className="hard-border flex flex-wrap items-center justify-between gap-3 bg-white p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.from.avatarUrl || "/decor/avatar-cat.svg"}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full border-2 border-black object-cover grayscale"
                  />
                  <div className="min-w-0">
                    <p className="pixel-font truncate text-xs">{r.from.displayName}</p>
                    <p className="mono-font text-base text-[#666]">@{r.from.handle}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    disabled={busyId === r.id || !online}
                    title={!online ? "Нет соединения" : undefined}
                    onClick={() => act(r.id, "accept")}
                  >
                    Принять
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    disabled={busyId === r.id || !online}
                    title={!online ? "Нет соединения" : undefined}
                    onClick={() => act(r.id, "decline")}
                  >
                    Отклонить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section>
          <h2 className="pixel-font mb-3 text-sm">Исходящие заявки</h2>
          <ul className="space-y-3">
            {outgoing.map((r) => (
              <li
                key={r.id}
                className="hard-border flex flex-wrap items-center justify-between gap-3 bg-white p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.to.avatarUrl || "/decor/avatar-cat.svg"}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full border-2 border-black object-cover grayscale"
                  />
                  <div className="min-w-0">
                    <p className="pixel-font truncate text-xs">{r.to.displayName}</p>
                    <p className="mono-font text-base text-[#666]">@{r.to.handle}</p>
                    <p className="mono-font text-sm text-[#999]">Ожидает ответа</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={busyId === r.id || !online}
                  title={!online ? "Нет соединения" : undefined}
                  onClick={() => act(r.id, "cancel")}
                >
                  Отменить
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
