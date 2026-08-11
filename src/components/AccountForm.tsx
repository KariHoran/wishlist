"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AVATAR_MAX_INPUT_BYTES,
  compressAvatarFile,
} from "@/lib/avatar-image";
import { useNetwork } from "@/components/NetworkProvider";

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
  const { online, requireOnline } = useNetwork();
  const [preview, setPreview] = useState(avatarUrl);
  const [pendingFile, setPendingFile] = useState<Blob | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onAvatarPick(file: File | undefined) {
    setError(null);
    setMessage(null);
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Можно загрузить только изображение");
      return;
    }
    if (file.size > AVATAR_MAX_INPUT_BYTES) {
      setError("Файл слишком большой, попробуйте другое фото");
      return;
    }

    try {
      const compressed = await compressAvatarFile(file);
      const objectUrl = URL.createObjectURL(compressed);
      setPreview((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return objectUrl;
      });
      setPendingFile(compressed);
    } catch {
      setError("Не удалось обработать изображение");
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireOnline()) return;
    setMessage(null);
    setError(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);

    try {
      let nextAvatarUrl = preview;
      if (pendingFile) {
        const uploadFd = new FormData();
        uploadFd.set("file", pendingFile, "avatar.jpg");
        const uploadRes = await fetch("/api/account/avatar", {
          method: "POST",
          body: uploadFd,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          setError(uploadData.error ?? "Не удалось загрузить аватар");
          return;
        }
        nextAvatarUrl = uploadData.url as string;
        setPendingFile(null);
        setPreview(nextAvatarUrl);
      }

      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: fd.get("displayName"),
          ...(nextAvatarUrl ? { avatarUrl: nextAvatarUrl } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка");
        return;
      }
      setMessage("Сохранено");
      router.refresh();
    } catch {
      setError("Ошибка сети");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="hard-border space-y-4 bg-white p-5">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview || "/decor/avatar-cat.svg"}
          alt=""
          className="h-16 w-16 rounded-full border-2 border-black object-cover"
        />
        <div className="space-y-1">
          <label className="btn-secondary cursor-pointer text-xs">
            Сменить аватар
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void onAvatarPick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {pendingFile && (
            <p className="mono-font text-[10px] text-black/60">
              Превью сжатого фото — нажмите «Сохранить»
            </p>
          )}
        </div>
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
      <button type="submit" className="btn-primary w-full" disabled={saving || !online} title={!online ? "Нет соединения" : undefined}>
        {saving ? "Сохранение…" : "Сохранить"}
      </button>
    </form>
  );
}
