"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  emailNotificationsEnabled,
}: {
  displayName: string;
  handle: string;
  email: string;
  avatarUrl: string | null;
  emailNotificationsEnabled: boolean;
}) {
  const router = useRouter();
  const { online, requireOnline } = useNetwork();
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [preview, setPreview] = useState(avatarUrl);
  const [pendingFile, setPendingFile] = useState<Blob | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [emailNotif, setEmailNotif] = useState(emailNotificationsEnabled);

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
      setError(tErrors("imageType"));
      return;
    }
    if (file.size > AVATAR_MAX_INPUT_BYTES) {
      setError(tErrors("fileTooLarge"));
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
      setError(tErrors("imageProcessFailed"));
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
          setError(uploadData.error ?? t("uploadFailed"));
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
          emailNotificationsEnabled: emailNotif,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? tErrors("generic"));
        return;
      }
      setMessage(tCommon("saved"));
      router.refresh();
    } catch {
      setError(t("networkError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="hard-border space-y-4 bg-white p-5">
      <div className="flex items-center gap-4">
        <Image
          src={preview || "/decor/avatar-halftone-cat.png"}
          alt={t("avatarAlt", { name: displayName })}
          width={64}
          height={64}
          unoptimized={Boolean(preview?.startsWith("blob:"))}
          className="h-16 w-16 rounded-full border-2 border-black object-cover"
        />
        <div className="space-y-1">
          <label className="btn-secondary cursor-pointer text-xs">
            {t("changeAvatar")}
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
            <p className="mono-font text-[10px] text-black/60">{t("pendingPreview")}</p>
          )}
        </div>
      </div>
      <div>
        <label htmlFor="account-display-name" className="pixel-font mb-2 block text-xs">
          {t("name")}
        </label>
        <input
          id="account-display-name"
          name="displayName"
          defaultValue={displayName}
          required
          className="input-field"
        />
      </div>
      <div>
        <label htmlFor="account-handle" className="pixel-font mb-2 block text-xs">
          {t("handle")}
        </label>
        <input
          id="account-handle"
          value={`@${handle}`}
          readOnly
          className="input-field bg-[#f3f3f3]"
        />
      </div>
      <div>
        <label htmlFor="account-email" className="pixel-font mb-2 block text-xs">
          {t("email")}
        </label>
        <input
          id="account-email"
          value={email}
          readOnly
          className="input-field bg-[#f3f3f3]"
        />
      </div>
      <div>
        <label
          htmlFor="account-email-notif"
          className="mono-font flex cursor-pointer items-center gap-2 text-base"
        >
          <input
            id="account-email-notif"
            type="checkbox"
            className="h-4 w-4 accent-black"
            checked={emailNotif}
            onChange={(e) => setEmailNotif(e.target.checked)}
          />
          {t("emailNotif")}
        </label>
        <p className="mono-font mt-1 text-sm text-[#888]">{t("emailNotifHint")}</p>
      </div>
      {error && <p className="mono-font text-red-600">{error}</p>}
      {message && <p className="mono-font text-green-700">{message}</p>}
      <button
        type="submit"
        className="btn-primary w-full"
        disabled={saving || !online}
        title={!online ? tCommon("noConnection") : undefined}
      >
        {saving ? tCommon("saving") : tCommon("save")}
      </button>
    </form>
  );
}
