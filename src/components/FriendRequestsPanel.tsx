"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useNetwork } from "@/components/NetworkProvider";
import { RetroInlineState } from "@/components/RetroState";

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
  const [localIncoming, setLocalIncoming] = useState(incoming);
  const [localOutgoing, setLocalOutgoing] = useState(outgoing);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLocalIncoming(incoming);
      setLocalOutgoing(outgoing);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [incoming, outgoing]);

  async function act(id: string, action: "accept" | "decline" | "cancel") {
    if (!requireOnline()) return;
    const prevIncoming = localIncoming;
    const prevOutgoing = localOutgoing;
    if (action === "cancel") {
      setLocalOutgoing((list) => list.filter((r) => r.id !== id));
    } else {
      setLocalIncoming((list) => list.filter((r) => r.id !== id));
    }
    setBusyId(id);
    const res = await fetch(`/api/friends/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setLocalIncoming(prevIncoming);
      setLocalOutgoing(prevOutgoing);
      alert(data.error ?? "Ошибка");
      return;
    }
    router.refresh();
  }

  if (localIncoming.length === 0 && localOutgoing.length === 0) {
    return (
      <RetroInlineState
        title="Заявок пока нет"
        message="Когда кто-то отправит запрос в друзья, он появится здесь."
      />
    );
  }

  return (
    <div className="mb-8 space-y-6">
      {localIncoming.length > 0 && (
        <section>
          <h2 className="pixel-font mb-3 text-sm">Входящие заявки</h2>
          <ul className="space-y-3">
            {localIncoming.map((r) => (
              <li
                key={r.id}
                className="hard-border flex flex-wrap items-center justify-between gap-3 bg-white p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.from.avatarUrl || "/decor/avatar-halftone-cat.png"}
                    alt={`Аватар пользователя ${r.from.displayName}`}
                    width={40}
                    height={40}
                    className="h-10 w-10 shrink-0 rounded-full border-2 border-black object-cover"
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

      {localOutgoing.length > 0 && (
        <section>
          <h2 className="pixel-font mb-3 text-sm">Исходящие заявки</h2>
          <ul className="space-y-3">
            {localOutgoing.map((r) => (
              <li
                key={r.id}
                className="hard-border flex flex-wrap items-center justify-between gap-3 bg-white p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.to.avatarUrl || "/decor/avatar-halftone-cat.png"}
                    alt={`Аватар пользователя ${r.to.displayName}`}
                    width={40}
                    height={40}
                    className="h-10 w-10 shrink-0 rounded-full border-2 border-black object-cover"
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
