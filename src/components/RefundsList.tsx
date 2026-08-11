"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRub } from "@/lib/money";

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
  const [busy, setBusy] = useState<string | null>(null);

  async function markRefunded(contributionId: string) {
    setBusy(contributionId);
    const res = await fetch(`/api/contributions/${contributionId}/refund`, {
      method: "PATCH",
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Ошибка");
      return;
    }
    router.refresh();
  }

  if (groups.length === 0) {
    return (
      <div className="hard-border mt-6 bg-white p-8 text-center">
        <p className="display-font text-sm">Всё возвращено, долгов нет 🎉</p>
        <p className="mono-font mt-2 text-lg text-[#666]">
          Здесь появятся взносы, которые нужно вернуть вручную после отмены сбора
        </p>
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
                    disabled={busy === row.id}
                    onClick={() => markRefunded(row.id)}
                  >
                    {busy === row.id ? "..." : "Отметить как возвращено"}
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
