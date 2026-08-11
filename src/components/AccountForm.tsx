"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AccountForm({
  displayName,
  handle,
  email,
  avatarUrl,
}: {
  displayName: string;
  handle: string;
  email: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState(avatarUrl);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: fd.get("displayName"),
        avatarUrl: preview,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Ошибка");
      return;
    }
    setMessage("Сохранено");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="hard-border space-y-4 bg-white p-5">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview || "/decor/avatar-cat.svg"}
          alt=""
          className="h-16 w-16 rounded-full border-2 border-black object-cover grayscale"
        />
        <label className="btn-secondary cursor-pointer text-xs">
          Сменить аватар
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 24_000) {
                setError("Аватар слишком большой — выберите файл до ~20 КБ");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setPreview(String(reader.result));
              reader.readAsDataURL(file);
            }}
          />
        </label>
      </div>
      <div>
        <label className="pixel-font mb-2 block text-xs">Имя</label>
        <input
          name="displayName"
          defaultValue={displayName}
          required
          className="input-field"
        />
      </div>
      <div>
        <label className="pixel-font mb-2 block text-xs">Ник (только чтение)</label>
        <input value={`@${handle}`} readOnly className="input-field bg-[#f3f3f3]" />
      </div>
      <div>
        <label className="pixel-font mb-2 block text-xs">Email</label>
        <input value={email} readOnly className="input-field bg-[#f3f3f3]" />
      </div>
      {error && <p className="mono-font text-red-600">{error}</p>}
      {message && <p className="mono-font text-green-700">{message}</p>}
      <button type="submit" className="btn-primary w-full">
        Сохранить
      </button>
    </form>
  );
}
