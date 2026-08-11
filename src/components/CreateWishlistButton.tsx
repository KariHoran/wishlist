"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function CreateWishlistButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/wishlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fd.get("title"),
        deadline: fd.get("deadline") || null,
        isPublic: fd.get("isPublic") === "on",
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка");
      return;
    }
    setOpen(false);
    router.push(`/wishlist/${data.id}`);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pixel-font text-xs leading-normal underline underline-offset-4 sm:text-sm"
      >
        + Создать вишлист
      </button>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h2 className="display-font mb-4 text-center text-sm md:text-base">
              Новый вишлист
            </h2>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="pixel-font mb-2 block text-xs">Название</label>
                <input name="title" required className="input-field" placeholder="День рождения" />
              </div>
              <div>
                <label className="pixel-font mb-2 block text-xs">Дедлайн (необязательно)</label>
                <input name="deadline" type="date" className="input-field" />
              </div>
              <label className="mono-font flex items-center gap-2 text-lg">
                <input type="checkbox" name="isPublic" className="h-4 w-4 accent-black" />
                Публичный список
              </label>
              {error && <p className="text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  Создать
                </button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setOpen(false)}>
                  Назад
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
