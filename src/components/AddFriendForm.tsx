"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useNetwork } from "@/components/NetworkProvider";

export function AddFriendForm() {
  const router = useRouter();
  const { online, requireOnline } = useNetwork();
  const t = useTranslations("friends");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendingAccept, setPendingAccept] = useState<{
    requestId: string;
    name: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [optimisticOutgoing, setOptimisticOutgoing] = useState<string[]>([]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireOnline()) return;
    setError(null);
    setOk(null);
    setPendingAccept(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const handle = String(fd.get("handle") ?? "").replace(/^@/, "").trim();
    const optimisticHandle = handle.toLowerCase();
    setOptimisticOutgoing((list) =>
      list.includes(optimisticHandle) ? list : [optimisticHandle, ...list],
    );
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.status === 409 && data.needsAccept && data.requestId) {
      setOptimisticOutgoing((list) => list.filter((h) => h !== optimisticHandle));
      setPendingAccept({
        requestId: data.requestId,
        name: data.from?.displayName ?? handle,
      });
      setError(data.error ?? t("incomingTitle"));
      return;
    }
    if (!res.ok) {
      setOptimisticOutgoing((list) => list.filter((h) => h !== optimisticHandle));
      setError(data.error ?? tErrors("generic"));
      return;
    }
    setOk(t("sent"));
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
      setError(data.error ?? t("acceptFailed"));
      return;
    }
    setPendingAccept(null);
    setError(null);
    setOk(t("accepted"));
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="hard-border flex flex-col gap-3 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <div className="min-w-0 flex-1">
        <label htmlFor="friend-handle" className="pixel-font mb-2 block text-xs">
          {t("handleLabel")}
        </label>
        <input
          id="friend-handle"
          name="handle"
          required
          placeholder="@nickname"
          className="input-field"
        />
      </div>
      <button
        type="submit"
        disabled={busy || !online}
        className="btn-primary whitespace-nowrap"
        title={!online ? tCommon("noConnection") : undefined}
      >
        {t("add")}
      </button>
      {pendingAccept && (
        <button
          type="button"
          disabled={busy || !online}
          className="btn-secondary whitespace-nowrap"
          onClick={acceptIncoming}
          title={!online ? tCommon("noConnection") : undefined}
        >
          {t("acceptFrom", { name: pendingAccept.name })}
        </button>
      )}
      {error && <p className="mono-font w-full text-red-600 sm:order-last">{error}</p>}
      {ok && <p className="mono-font w-full text-green-700 sm:order-last">{ok}</p>}
      {optimisticOutgoing.length > 0 && (
        <p className="mono-font w-full text-[#666] sm:order-last">
          {t("optimisticOutgoing", {
            handles: optimisticOutgoing.map((h) => `@${h}`).join(", "),
          })}
        </p>
      )}
    </form>
  );
}
