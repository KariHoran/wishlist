"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ProgressBar } from "@/components/ProgressBar";
import { useNetwork } from "@/components/NetworkProvider";
import { RetroInlineState } from "@/components/RetroState";

export type FriendCard = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  wishlists: {
    id: string;
    title: string;
    percent: number;
    itemCount: number;
  }[];
};

const DEFAULT_AVATAR = "/decor/avatar-halftone-cat.png";

export function FriendsList({ initialFriends }: { initialFriends: FriendCard[] }) {
  const router = useRouter();
  const { requireOnline } = useNetwork();
  const [friends, setFriends] = useState(initialFriends);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function removeFriend(friendId: string) {
    if (!requireOnline()) return;
    setError(null);
    const prev = friends;
    setFriends((list) => list.filter((f) => f.id !== friendId));
    setPendingId(friendId);
    try {
      const res = await fetch(`/api/friends/${friendId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFriends(prev);
        setError(data.error ?? "Не удалось удалить");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setFriends(prev);
      setError("Ошибка сети");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="mono-font text-base text-[#c44]" role="alert">
          {error}
        </p>
      )}
      {friends.map((f) => (
        <details key={f.id} className="hard-border bg-white p-4">
          <summary className="cursor-pointer list-none">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Image
                  src={f.avatarUrl || DEFAULT_AVATAR}
                  alt={`Аватар пользователя ${f.displayName}`}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full border-2 border-black object-cover"
                />
                <div>
                  <p className="pixel-font text-sm">{f.displayName}</p>
                  <p className="mono-font text-base text-[#666]">@{f.handle}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="btn-secondary text-xs">Посмотреть вишлисты</span>
                <button
                  type="button"
                  className="hard-border flex h-8 w-8 items-center justify-center bg-white pixel-font text-sm leading-none hover:bg-[#eee]"
                  aria-label={`Удалить ${f.displayName} из друзей`}
                  disabled={pendingId === f.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void removeFriend(f.id);
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          </summary>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {f.wishlists.map((w) => (
              <article key={w.id} className="hard-border p-3">
                <h3 className="pixel-font text-sm">{w.title}</h3>
                <div className="mt-2">
                  <ProgressBar percent={w.percent} height={12} />
                </div>
                <p className="mono-font mt-1 mb-3 text-base">
                  {w.percent}% · {w.itemCount} предметов
                </p>
                <Link href={`/wishlist/${w.id}`} className="btn-primary w-full text-xs">
                  Открыть
                </Link>
              </article>
            ))}
            {f.wishlists.length === 0 && (
              <RetroInlineState
                compact
                title="Нет публичных вишлистов"
                message="Когда он откроет списки для друзей, они появятся здесь."
              />
            )}
          </div>
          <Link
            href={`/f/${f.handle}`}
            className="pixel-font mt-3 inline-block text-xs underline underline-offset-4 leading-normal"
          >
            Публичный профиль →
          </Link>
        </details>
      ))}
      {friends.length === 0 && (
        <RetroInlineState
          title="Пока нет друзей"
          message="Отправьте первую заявку по нику."
        />
      )}
    </div>
  );
}
