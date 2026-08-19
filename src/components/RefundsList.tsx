"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useNetwork } from "@/components/NetworkProvider";
import { RetroInlineState } from "@/components/RetroState";

type RefundGroup = {
  itemId: string;
  itemName: string;
  wishlistTitle: string;
  rows: {
    id: string;
    displayName: string;
    handle: string;
    amountFormatted: string;
  }[];
};

export function RefundsList({ groups }: { groups: RefundGroup[] }) {
  const router = useRouter();
  const { online, requireOnline } = useNetwork();
  const t = useTranslations("refunds");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [busy, setBusy] = useState<string | null>(null);

  async function markRefunded(contributionId: string) {
    if (!requireOnline()) return;
    setBusy(contributionId);
    const res = await fetch(`/api/contributions/${contributionId}/refund`, {
      method: "PATCH",
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? tErrors("generic"));
      return;
    }
    router.refresh();
  }

  if (groups.length === 0) {
    return (
      <div className="mt-6">
        <RetroInlineState title={t("emptyTitle")} message={t("emptyMessage")} />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {groups.map((g) => (
        <section key={g.itemId} className="hard-border bg-white p-4">
          <h2 className="pixel-font text-sm leading-relaxed">{g.itemName}</h2>
          <p className="mono-font text-base text-[#666]">{g.wishlistTitle}</p>
          <ul className="mt-4 space-y-3">
            {g.rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eee] pt-3 first:border-0 first:pt-0"
              >
                <div>
                  <p className="pixel-font text-xs">{row.displayName}</p>
                  <p className="mono-font text-sm text-[#888]">@{row.handle}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="mono-font text-lg">{row.amountFormatted}</span>
                  <button
                    type="button"
                    className="btn-primary text-[10px]"
                    disabled={busy === row.id || !online}
                    title={!online ? tCommon("noConnection") : undefined}
                    onClick={() => markRefunded(row.id)}
                  >
                    {busy === row.id ? tCommon("loading") : t("markDone")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
