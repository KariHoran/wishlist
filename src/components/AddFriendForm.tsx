"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useNetwork } from "@/components/NetworkProvider";

export function AddFriendForm() {
  const router = useRouter();
  const { online, requireOnline } = useNetwork();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendingAccept, setPendingAccept] = useState<{
    requestId: string;
    name: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireOnline()) return;
    setError(null);
    setOk(null);
    setPendingAccept(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const handle = String(fd.get("handle") ?? "").replace(/^@/, "").trim();
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.status === 409 && data.needsAccept && data.requestId) {
      setPendingAccept({
        requestId: data.requestId,
        name: data.from?.displayName ?? handle,
      });
      setError(data.error ?? "Есть входящая заявка");
      return;
    }
    if (!res.ok) {
      setError(data.error ?? "Ошибка");
      return;
    }
    setOk("Заявка отправлена");
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  async function acceptIncoming() {
    if (!pendingAccept) return;
    if (!requireOnline()) return;
    setBusy(true);
    const res = await fetch(`/api/friends/${pendingAccept.requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Не удалось принять");
      return;
    }
    setPendingAccept(null);
    setError(null);
    setOk("Заявка принята — вы теперь друзья");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="hard-border flex flex-col gap-3 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <div className="min-w-0 flex-1">
        <label className="pixel-font mb-2 block text-xs">Ник друга</label>
        <input name="handle" required placeholder="@nickname" className="input-field" />
      </div>
      <button
        type="submit"
        disabled={busy || !online}
        className="btn-primary whitespace-nowrap"
        title={!online ? "Нет соединения" : undefined}
      >
        + Добавить
      </button>
      {pendingAccept && (
        <button
          type="button"
          disabled={busy || !online}
          className="btn-secondary whitespace-nowrap"
          onClick={acceptIncoming}
          title={!online ? "Нет соединения" : undefined}
        >
          Принять заявку от {pendingAccept.name}
        </button>
      )}
      {error && <p className="mono-font w-full text-red-600 sm:order-last">{error}</p>}
      {ok && <p className="mono-font w-full text-green-700 sm:order-last">{ok}</p>}
    </form>
  );
}
