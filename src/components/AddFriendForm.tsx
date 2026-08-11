"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AddFriendForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const fd = new FormData(e.currentTarget);
    const handle = String(fd.get("handle") ?? "").replace(/^@/, "").trim();
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Ошибка");
      return;
    }
    setOk("Друг добавлен!");
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="hard-border flex flex-col gap-3 bg-white p-4 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="pixel-font mb-2 block text-xs">Ник друга</label>
        <input name="handle" required placeholder="@nickname" className="input-field" />
      </div>
      <button type="submit" className="btn-primary whitespace-nowrap">
        + Добавить
      </button>
      {error && <p className="mono-font w-full text-red-600 sm:order-last">{error}</p>}
      {ok && <p className="mono-font w-full text-green-700 sm:order-last">{ok}</p>}
    </form>
  );
}
