"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ModalDialog } from "@/components/ModalDialog";
import { ProgressBar } from "@/components/ProgressBar";
import { RetroInlineState } from "@/components/RetroState";
import { useNetwork } from "@/components/NetworkProvider";
import { formatRub } from "@/lib/money";

type WishlistCard = {
  id: string;
  title: string;
  deadline: string | null;
  progressPercent: number;
  itemCount: number;
};

type ConfirmModal = {
  wishlistCount: number;
  itemCount: number;
  contributorCount: number;
  totalAmount: number;
};

export function DashboardWishlistGrid({ wishlists }: { wishlists: WishlistCard[] }) {
  const router = useRouter();
  const { online, requireOnline } = useNetwork();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null);

  const selectedIds = useMemo(() => [...selected], [selected]);
  const allSelected = wishlists.length > 0 && selected.size === wishlists.length;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(wishlists.map((w) => w.id)));
  }

  async function deleteSelected(confirmed = false) {
    if (!requireOnline() || selectedIds.length === 0) return;

    setBusy(true);
    const res = await fetch("/api/wishlists/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: selectedIds,
        confirm: confirmed || undefined,
      }),
    });
    setBusy(false);

    if (res.status === 409) {
      const data = await res.json();
      setConfirmModal({
        wishlistCount: data.wishlistCount ?? selectedIds.length,
        itemCount: data.itemCount,
        contributorCount: data.contributorCount,
        totalAmount: data.totalAmount,
      });
      return;
    }

    if (!res.ok) {
      alert("Ошибка удаления");
      return;
    }

    setConfirmModal(null);
    setSelected(new Set());
    router.refresh();
  }

  if (wishlists.length === 0) {
    return (
      <div className="mt-8">
        <RetroInlineState
          title="Пока пусто"
          message="У вас пока нет вишлистов — создайте первый."
        />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="pixel-font flex cursor-pointer items-center gap-2 text-[10px] text-[#555] md:text-xs">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-black"
            checked={allSelected}
            onChange={toggleAll}
            aria-label="Выбрать все вишлисты"
          />
          {allSelected ? "Снять выбор" : "Выбрать все"}
        </label>
        {selected.size > 0 && (
          <button
            type="button"
            className="pixel-font text-[10px] text-[#666] underline underline-offset-4 md:text-xs"
            disabled={busy || !online}
            title={!online ? "Нет соединения" : undefined}
            onClick={() => void deleteSelected()}
          >
            Удалить выбранные ({selected.size})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {wishlists.map((w) => {
          const checked = selected.has(w.id);
          return (
            <article
              key={w.id}
              className={`hard-border relative z-10 flex flex-col bg-white p-4 ${checked ? "ring-2 ring-black ring-offset-2" : ""}`}
            >
              <label className="absolute top-3 right-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-black"
                  checked={checked}
                  onChange={() => toggleOne(w.id)}
                  aria-label={`Выбрать «${w.title}»`}
                />
              </label>
              <h2 className="pixel-font pr-8 text-base leading-relaxed">{w.title}</h2>
              <p className="mono-font mt-1 text-lg text-[#555]">
                {w.deadline
                  ? new Date(w.deadline).toLocaleDateString("sv-SE").replace(/-/g, ".")
                  : "Бессрочно"}
              </p>
              <div className="mt-3">
                <ProgressBar percent={w.progressPercent} height={14} />
              </div>
              <p className="mono-font mt-2 mb-4 text-base">
                {w.progressPercent}% собрано · {w.itemCount} предметов
              </p>
              <Link href={`/wishlist/${w.id}`} className="btn-primary mt-auto w-full">
                Открыть
              </Link>
            </article>
          );
        })}
      </div>

      {confirmModal && (
        <ModalDialog onClose={() => setConfirmModal(null)}>
          <h2 className="display-font mb-4 text-center text-sm">Внимание</h2>
          <p className="mono-font mb-4 text-lg leading-relaxed">
            Удаляется {confirmModal.wishlistCount} вишлист(ов). В {confirmModal.itemCount}{" "}
            предмет(ах) есть незавершённые сборы ({confirmModal.contributorCount}{" "}
            участник(ов), всего {formatRub(confirmModal.totalAmount)}). Сборы будут отменены —
            деньги нужно вернуть вручную. Продолжить?
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={busy}
              onClick={() => void deleteSelected(true)}
            >
              Продолжить
            </button>
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => setConfirmModal(null)}
            >
              Назад
            </button>
          </div>
        </ModalDialog>
      )}
    </>
  );
}
