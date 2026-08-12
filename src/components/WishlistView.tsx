"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProgressBar } from "@/components/ProgressBar";
import { PublicListBadge, WinExplorer, WinLoading } from "@/components/WinDecor";
import { formatPercent, formatRub, itemFundingPercent } from "@/lib/money";
import { useWishlistRealtime } from "@/hooks/useWishlistRealtime";
import { useNetwork } from "@/components/NetworkProvider";

export type ClientItem = {
  id: string;
  name: string;
  price: string | number;
  imageUrl: string | null;
  productUrl: string | null;
  status: "AVAILABLE" | "RESERVED" | "FUNDING" | "CANCELLED";
  amountCollected: string | number;
  reservedById: string | null;
  reservedBy?: { id: string; displayName: string; handle: string } | null;
  contributions?: {
    id: string;
    amount: string | number;
    user: { id: string; displayName: string; handle: string };
  }[];
  contributorCount?: number;
};

type Props = {
  wishlist: {
    id: string;
    title: string;
    emoji: string | null;
    isPublic: boolean;
    ownerId: string;
    deadline?: string | null;
  };
  items: ClientItem[];
  isOwner: boolean;
  isGuestView: boolean;
  currentUserId?: string;
};

export function WishlistView({
  wishlist,
  items,
  isOwner,
  isGuestView,
  currentUserId,
}: Props) {
  const router = useRouter();
  const { online, requireOnline } = useNetwork();
  useWishlistRealtime(wishlist.id);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editWishlistOpen, setEditWishlistOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelModal, setCancelModal] = useState<{
    kind: "item" | "wishlist" | "private";
    itemId?: string;
    itemName?: string;
    contributorCount: number;
    totalAmount: number;
    itemCount?: number;
  } | null>(null);

  const visibleItems = items.filter((i) => i.status !== "CANCELLED");
  const editItem = useMemo(
    () => visibleItems.find((i) => i.id === editItemId) ?? null,
    [visibleItems, editItemId],
  );

  const selected = useMemo(
    () => visibleItems.find((i) => i.id === selectedId) ?? null,
    [visibleItems, selectedId],
  );

  const collectedCount = visibleItems.filter((i) => i.status === "RESERVED").length;
  const percent =
    visibleItems.length === 0
      ? 0
      : Math.round((collectedCount / visibleItems.length) * 100);

  async function deleteWishlist(confirmed = false) {
    if (!requireOnline()) return;
    if (!confirmed && !cancelModal) {
      setBusy(true);
      const res = await fetch(`/api/wishlists/${wishlist.id}`, { method: "DELETE" });
      setBusy(false);
      if (res.status === 409) {
        const data = await res.json();
        setCancelModal({
          kind: "wishlist",
          contributorCount: data.contributorCount,
          totalAmount: data.totalAmount,
          itemCount: data.itemCount,
        });
        return;
      }
      if (!res.ok) {
        alert("Ошибка удаления");
        return;
      }
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setBusy(true);
    const res = await fetch(`/api/wishlists/${wishlist.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    setBusy(false);
    setCancelModal(null);
    if (!res.ok) {
      alert("Ошибка удаления");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function deleteItem(id: string, confirmed = false) {
    if (!requireOnline()) return;
    if (!confirmed) {
      setBusy(true);
      const preview = await fetch(`/api/items/${id}`);
      const data = await preview.json();
      if (data.requiresConfirmation) {
        setBusy(false);
        setCancelModal({
          kind: "item",
          itemId: id,
          itemName: data.itemName,
          contributorCount: data.contributorCount,
          totalAmount: data.totalAmount,
        });
        return;
      }
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      setBusy(false);
      if (!res.ok) {
        alert("Ошибка удаления");
        return;
      }
      router.refresh();
      return;
    }

    setBusy(true);
    const res = await fetch(`/api/items/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    setBusy(false);
    setCancelModal(null);
    if (!res.ok) {
      alert("Ошибка");
      return;
    }
    router.refresh();
  }

  async function itemAction(itemId: string, action: string, amount?: number) {
    if (!requireOnline()) return;
    if (!currentUserId) {
      router.push(`/login?callbackUrl=/wishlist/${wishlist.id}`);
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, amount }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Ошибка");
      return;
    }
    router.refresh();
  }

  async function togglePublic(confirmed = false) {
    if (!requireOnline()) return;
    if (!wishlist.isPublic) {
      setBusy(true);
      await fetch(`/api/wishlists/${wishlist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: true }),
      });
      setBusy(false);
      router.refresh();
      return;
    }

    if (!confirmed) {
      setBusy(true);
      const res = await fetch(`/api/wishlists/${wishlist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: false }),
      });
      setBusy(false);
      if (res.status === 409) {
        const data = await res.json();
        setCancelModal({
          kind: "private",
          contributorCount: data.contributorCount,
          totalAmount: data.totalAmount,
          itemCount: data.itemCount,
        });
        return;
      }
      router.refresh();
      return;
    }

    setBusy(true);
    await fetch(`/api/wishlists/${wishlist.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: false, confirm: true }),
    });
    setBusy(false);
    setCancelModal(null);
    router.refresh();
  }

  function confirmCancelModal() {
    if (!cancelModal) return;
    if (cancelModal.kind === "item" && cancelModal.itemId) {
      deleteItem(cancelModal.itemId, true);
    } else if (cancelModal.kind === "wishlist") {
      deleteWishlist(true);
    } else if (cancelModal.kind === "private") {
      togglePublic(true);
    }
  }

  return (
    <div className="relative isolate">
      {isGuestView && <PublicListBadge />}

      {/* Decor stays in page gutters / behind content — never over text */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/envelope.svg"
        alt=""
        className="page-decor top-[72%] left-0 hidden w-12 opacity-70 lg:block"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/notepad.svg"
        alt=""
        className="page-decor right-0 bottom-16 hidden w-11 opacity-70 lg:block"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/pixel-star.svg"
        alt=""
        className="page-decor right-2 top-8 hidden w-8 opacity-60 lg:block"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/halftone-cat.svg"
        alt=""
        className="page-decor bottom-4 left-[62%] hidden w-12 -translate-x-1/2 opacity-50 xl:block"
      />

      <div className="relative z-10">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <Link
          href="/dashboard"
          className="pixel-font text-xs underline underline-offset-4 leading-normal md:text-sm"
        >
          ← Обратно к вишлистам
        </Link>
        {isOwner && (
          <div className="flex flex-wrap items-start gap-4">
            <button
              type="button"
              onClick={() => {
                if (!requireOnline()) return;
                setEditWishlistOpen(true);
              }}
              disabled={!online}
              title={!online ? "Нет соединения" : undefined}
              className="pixel-font text-xs underline underline-offset-4 leading-normal md:text-sm"
            >
              Редактировать
            </button>
            <button
              type="button"
              onClick={() => togglePublic()}
              disabled={busy || !online}
              title={!online ? "Нет соединения" : undefined}
              className="pixel-font text-xs underline underline-offset-4 leading-normal md:text-sm"
            >
              {wishlist.isPublic ? "Сделать личным" : "Сделать публичным"}
            </button>
            <button
              type="button"
              onClick={() => deleteWishlist()}
              disabled={!online}
              title={!online ? "Нет соединения" : undefined}
              className="pixel-font text-xs text-[#666] underline underline-offset-4 leading-normal md:text-sm"
            >
              Удалить вишлист
            </button>
          </div>
        )}
      </div>

      <h1 className="display-font mb-6 flex flex-wrap items-start gap-3 text-2xl md:text-3xl">
        {wishlist.title}
        <span className="text-xl" aria-hidden>
          {wishlist.emoji || "💖"}
        </span>
      </h1>

      <div className="hard-border-thick mb-8 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="pixel-font text-sm">Прогресс</span>
          <span className="mono-font text-lg">
            {collectedCount}/{visibleItems.length} собрано ({percent}%)
          </span>
        </div>
        <ProgressBar percent={percent} segmented height={22} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {visibleItems.map((item) => {
          const statusLabel =
            item.status === "RESERVED"
              ? "Забронировано"
              : item.status === "FUNDING"
                ? "Сбор"
                : "Ожидание";
          const bulb =
            item.status === "RESERVED"
              ? "💡"
              : item.status === "FUNDING"
                ? "💚"
                : "💛";
          return (
            <article
              key={item.id}
              className="hard-border relative cursor-pointer bg-white"
              onClick={() => setSelectedId(item.id)}
            >
              {isOwner && (
                <div className="absolute top-1 right-2 z-10 flex items-center gap-1">
                  <button
                    type="button"
                    className="text-base leading-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!requireOnline()) return;
                      setEditItemId(item.id);
                    }}
                    disabled={!online}
                    title={!online ? "Нет соединения" : "Редактировать"}
                    aria-label="Редактировать"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="text-lg leading-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteItem(item.id);
                    }}
                    disabled={!online}
                    title={!online ? "Нет соединения" : "Удалить"}
                    aria-label="Удалить"
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className="aspect-square border-b-2 border-black bg-[#eee]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl || "/decor/halftone-cat.svg"}
                  alt=""
                  className={`h-full w-full object-cover ${item.status === "RESERVED" ? "grayscale" : ""}`}
                />
              </div>
              <div className="p-3">
                <p className="pixel-font text-xs leading-relaxed">{item.name}</p>
                <p className="mono-font text-xl">{formatRub(Number(item.price))}</p>
                <p className="mono-font mt-1 flex items-center gap-1 text-base">
                  <span>{bulb}</span> {statusLabel}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      {isOwner && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            className="btn-primary px-8"
            disabled={!online}
            title={!online ? "Нет соединения" : undefined}
            onClick={() => {
              if (!requireOnline()) return;
              setAddOpen(true);
            }}
          >
            + Добавить предметы
          </button>
        </div>
      )}
      </div>

      {cancelModal && (
        <div className="modal-backdrop" onClick={() => setCancelModal(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h2 className="display-font mb-4 text-center text-sm">Внимание</h2>
            {cancelModal.kind === "item" ? (
              <p className="mono-font mb-4 text-lg leading-relaxed">
                На подарок «{cancelModal.itemName}» скинулись{" "}
                {cancelModal.contributorCount} человек(а) на сумму{" "}
                {formatRub(cancelModal.totalAmount)}. Удаление отменит сбор — вам
                нужно будет вернуть деньги каждому вручную. Продолжить?
              </p>
            ) : (
              <p className="mono-font mb-4 text-lg leading-relaxed">
                В {cancelModal.itemCount} предмет(ах) есть незавершённые сборы (
                {cancelModal.contributorCount} участник(ов), всего{" "}
                {formatRub(cancelModal.totalAmount)}). Сборы будут отменены — деньги
                нужно вернуть вручную. Продолжить?
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={busy}
                onClick={confirmCancelModal}
              >
                Продолжить
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setCancelModal(null)}
              >
                Назад
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <ItemModal
          item={selected}
          isOwner={isOwner}
          isGuestView={isGuestView}
          currentUserId={currentUserId}
          busy={busy}
          onClose={() => setSelectedId(null)}
          onReserve={() => itemAction(selected.id, "reserve")}
          onUnreserve={() => itemAction(selected.id, "unreserve")}
          onContribute={(amount) => itemAction(selected.id, "contribute", amount)}
          onStartFunding={() => itemAction(selected.id, "start_funding")}
          onStopFunding={() => itemAction(selected.id, "stop_funding")}
        />
      )}

      {addOpen && (
        <ItemFormModal
          wishlistId={wishlist.id}
          onClose={() => setAddOpen(false)}
          onDone={() => {
            setAddOpen(false);
            router.refresh();
          }}
        />
      )}

      {editWishlistOpen && (
        <EditWishlistModal
          wishlist={wishlist}
          onClose={() => setEditWishlistOpen(false)}
          onDone={() => {
            setEditWishlistOpen(false);
            router.refresh();
          }}
        />
      )}

      {editItem && (
        <ItemFormModal
          wishlistId={wishlist.id}
          item={editItem}
          onClose={() => setEditItemId(null)}
          onDone={() => {
            setEditItemId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ItemModal({
  item,
  isOwner,
  isGuestView,
  currentUserId,
  busy,
  onClose,
  onReserve,
  onUnreserve,
  onContribute,
  onStartFunding,
  onStopFunding,
}: {
  item: ClientItem;
  isOwner: boolean;
  isGuestView: boolean;
  currentUserId?: string;
  busy: boolean;
  onClose: () => void;
  onReserve: () => void;
  onUnreserve: () => void;
  onContribute: (amount: number) => void;
  onStartFunding: () => void;
  onStopFunding: () => void;
}) {
  const [chipIn, setChipIn] = useState(false);
  const [amount, setAmount] = useState("");
  const { online, requireOnline } = useNetwork();
  const fundingPct = itemFundingPercent(item.amountCollected, item.price);
  const isFunding =
    item.status === "FUNDING" || Number(item.amountCollected) > 0 || chipIn;
  const myReservation = item.reservedById === currentUserId;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      {isGuestView && <PublicListBadge />}
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="absolute top-3 right-4 text-xl"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ✕
        </button>
        <h2 className="display-font mb-4 pr-8 text-center text-sm leading-relaxed md:text-base">
          {item.name}
        </h2>

        {/* Owner aggregate view */}
        {isOwner && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="hard-border h-28 w-28 shrink-0 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl || "/decor/halftone-cat.svg"}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1">
                <p className="mono-font text-lg">
                  {formatPercent(fundingPct, 2)} собрано
                </p>
                <p className="display-font text-xl">{formatRub(Number(item.price))}</p>
                <div className="mt-2">
                  <ProgressBar percent={fundingPct} height={14} />
                </div>
                <p className="mono-font mt-2 text-base text-[#666]">
                  Участники скрыты — сюрприз!
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              {item.status !== "FUNDING" ? (
                <button
                  type="button"
                  disabled={busy || item.status === "RESERVED" || !online}
                  title={!online ? "Нет соединения" : undefined}
                  className="btn-primary flex-1"
                  onClick={onStartFunding}
                >
                  Начать сбор
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || !online}
                  title={!online ? "Нет соединения" : undefined}
                  className="btn-secondary flex-1"
                  onClick={onStopFunding}
                >
                  Остановить сбор
                </button>
              )}
              <button type="button" className="btn-secondary flex-1" onClick={onClose}>
                Назад
              </button>
            </div>
          </div>
        )}

        {/* Guest funding / contribute list */}
        {!isOwner && isFunding && !chipIn && item.status !== "RESERVED" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="hard-border h-32 w-32 shrink-0 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl || "/decor/halftone-cat.svg"}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1">
                <p className="mono-font text-lg">
                  {formatPercent(fundingPct, 2)} собрано
                </p>
                <p className="display-font text-2xl">{formatRub(Number(item.price))}</p>
                <div className="mt-2">
                  <ProgressBar percent={fundingPct} height={14} />
                </div>
              </div>
            </div>

              <div className="relative space-y-2 pl-0 sm:pl-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/decor/halftone-cat.svg"
                alt=""
                className="page-decor -left-10 top-2 hidden w-14 opacity-30 xl:block"
              />
              <div className="relative z-10 space-y-2">
              {(item.contributions ?? []).map((c, idx) => (
                <div key={c.id} className="leader-row relative z-10">
                  <span>
                    {idx + 1}. {c.user.displayName}
                    {idx === 0 ? " 💛" : ""}
                  </span>
                  <span className="leader-dots" />
                  <span>{formatRub(Number(c.amount))}</span>
                </div>
              ))}
              {(item.contributions ?? []).length === 0 && (
                <p className="mono-font text-lg text-[#777]">Пока никто не скинулся</p>
              )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={busy || !online}
                title={!online ? "Нет соединения" : undefined}
                onClick={() => {
                  if (!requireOnline()) return;
                  setChipIn(true);
                }}
              >
                Скинуться
              </button>
              <button type="button" className="btn-secondary flex-1" onClick={onClose}>
                Назад
              </button>
            </div>
          </div>
        )}

        {/* Guest available: reserve / chip in */}
        {!isOwner &&
          item.status === "AVAILABLE" &&
          !chipIn &&
          Number(item.amountCollected) === 0 && (
          <div className="space-y-5">
            <div className="mx-auto hard-border h-48 w-48 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl || "/decor/halftone-cat.svg"}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <p className="display-font text-center text-2xl">
              {formatRub(Number(item.price))}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={busy || !online}
                title={!online ? "Нет соединения" : undefined}
                onClick={onReserve}
              >
                Зарезервировать
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                disabled={busy || !online}
                title={!online ? "Нет соединения" : undefined}
                onClick={() => {
                  if (!requireOnline()) return;
                  setChipIn(true);
                }}
              >
                Скинуться
              </button>
            </div>
          </div>
        )}

        {/* Reserved by someone */}
        {!isOwner && item.status === "RESERVED" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto hard-border h-48 w-48 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl || "/decor/halftone-cat.svg"}
                alt=""
                className="h-full w-full object-cover grayscale"
              />
            </div>
            <p className="mono-font text-xl">
              Забронировано
              {item.reservedBy ? `: ${item.reservedBy.displayName}` : ""}
            </p>
            {myReservation ? (
              <button
                type="button"
                className="btn-secondary w-full"
                disabled={busy || !online}
                title={!online ? "Нет соединения" : undefined}
                onClick={onUnreserve}
              >
                Снять бронь
              </button>
            ) : (
              <button type="button" className="btn-secondary w-full" onClick={onClose}>
                Назад
              </button>
            )}
          </div>
        )}

        {/* Chip-in amount form */}
        {chipIn && !isOwner && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!requireOnline()) return;
              const n = Number(amount);
              if (!n) return;
              onContribute(n);
              setChipIn(false);
              setAmount("");
            }}
          >
            <p className="pixel-font text-center text-sm">Сколько скинуть?</p>
            <input
              className="input-field"
              inputMode="decimal"
              placeholder="Сумма ₽"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex-1" disabled={busy || !online} title={!online ? "Нет соединения" : undefined}>
                Скинуться
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setChipIn(false)}
              >
                Назад
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function EditWishlistModal({
  wishlist,
  onClose,
  onDone,
}: {
  wishlist: {
    id: string;
    title: string;
    isPublic: boolean;
    deadline?: string | null;
  };
  onClose: () => void;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { online, requireOnline } = useNetwork();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireOnline()) return;
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/wishlists/${wishlist.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fd.get("title"),
        deadline: fd.get("deadline") || null,
        isPublic: fd.get("isPublic") === "on",
      }),
    });
    let data = await res.json().catch(() => ({}));
    if (res.status === 409 && data.requiresConfirmation) {
      const ok = window.confirm(
        `В ${data.itemCount} предмет(ах) есть незавершённые сборы. Сделать личным и отменить сборы?`,
      );
      if (!ok) {
        setLoading(false);
        return;
      }
      const retry = await fetch(`/api/wishlists/${wishlist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fd.get("title"),
          deadline: fd.get("deadline") || null,
          isPublic: false,
          confirm: true,
        }),
      });
      data = await retry.json().catch(() => ({}));
      setLoading(false);
      if (!retry.ok) {
        setError(data.error ?? "Ошибка");
        return;
      }
      onDone();
      return;
    }
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка");
      return;
    }
    onDone();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="display-font mb-4 text-center text-sm md:text-base">
          Редактировать вишлист
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="pixel-font mb-2 block text-xs">Название</label>
            <input
              name="title"
              required
              className="input-field"
              defaultValue={wishlist.title}
            />
          </div>
          <div>
            <label className="pixel-font mb-2 block text-xs">Дедлайн (необязательно)</label>
            <input
              name="deadline"
              type="date"
              className="input-field"
              defaultValue={wishlist.deadline ?? ""}
            />
          </div>
          <label className="mono-font flex items-center gap-2 text-lg">
            <input
              type="checkbox"
              name="isPublic"
              className="h-4 w-4 accent-black"
              defaultChecked={wishlist.isPublic}
            />
            Публичный список
          </label>
          {error && <p className="mono-font text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !online}
              className="btn-primary flex-1"
              title={!online ? "Нет соединения" : undefined}
            >
              Сохранить
            </button>
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>
              Назад
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ItemFormModal({
  wishlistId,
  item,
  onClose,
  onDone,
}: {
  wishlistId: string;
  item?: ClientItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const editing = Boolean(item);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(item?.imageUrl ?? null);
  const { online, requireOnline } = useNetwork();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireOnline()) return;
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const productUrl = String(fd.get("productUrl") ?? "").trim();
    const name = String(fd.get("name") ?? "").trim();
    const price = Number(fd.get("price"));

    if (editing && item) {
      const priceChanging = price !== Number(item.price);
      const risky =
        priceChanging &&
        (item.status === "RESERVED" ||
          item.status === "FUNDING" ||
          Number(item.amountCollected) > 0);
      if (risky) {
        const ok = window.confirm(
          "У этого подарка уже есть бронь/взносы — изменение цены может сбить прогресс сбора. Продолжить?",
        );
        if (!ok) {
          setLoading(false);
          return;
        }
      }

      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          name,
          price,
          imageUrl: preview,
          productUrl: productUrl || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setError(data.error ?? "Ошибка");
        return;
      }
      onDone();
      return;
    }

    const body =
      productUrl && !name
        ? { productUrl }
        : {
            name,
            price,
            imageUrl: preview,
            productUrl: productUrl || null,
          };

    const res = await fetch(`/api/wishlists/${wishlistId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка");
      return;
    }
    onDone();
  }

  function onFile(file?: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel relative overflow-visible" onClick={(e) => e.stopPropagation()}>
        {!editing && (
          <>
            <WinLoading className="absolute -top-8 -left-6 z-20 hidden rotate-[-6deg] md:block" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/decor/orbit-star.svg"
              alt=""
              className="pointer-events-none absolute -top-4 -right-8 hidden w-16 md:block"
            />
            <WinExplorer className="absolute -right-10 -bottom-16 z-20 hidden rotate-3 md:block" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/decor/pixel-star.svg"
              alt=""
              className="pointer-events-none absolute -bottom-6 -left-8 hidden w-10 md:block"
            />
          </>
        )}

        <h2 className="display-font mb-5 text-center text-sm md:text-base">
          {editing ? "Редактировать предмет" : "Добавить новый предмет"}
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="pixel-font mb-2 block text-xs">Название предмета</label>
            <input
              name="name"
              className="input-field"
              defaultValue={item?.name ?? ""}
              required={editing}
            />
          </div>
          <div>
            <label className="pixel-font mb-2 block text-xs">Цена</label>
            <input
              name="price"
              type="number"
              min="0"
              step="1"
              className="input-field"
              defaultValue={item ? String(Number(item.price)) : ""}
              required={editing}
            />
          </div>
          <label className="btn-primary inline-flex cursor-pointer text-xs">
            {preview ? "Сменить изображение" : "+ Загрузить изображение"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="hard-border h-24 w-24 object-cover" />
          )}
          <button
            type="submit"
            disabled={loading || !online}
            className="btn-primary w-full py-3"
            title={!online ? "Нет соединения" : undefined}
          >
            {editing ? "Сохранить изменения" : "+ Добавить предмет"}
          </button>
          {!editing && <p className="pixel-font text-center text-xs">Или</p>}
          <div>
            <label className="pixel-font mb-2 block text-xs">
              {editing ? "Ссылка на товар" : "Вставить ссылку"}
            </label>
            <input
              name="productUrl"
              className="input-field"
              placeholder="https://..."
              defaultValue={item?.productUrl ?? ""}
            />
          </div>
          {error && <p className="mono-font text-red-600">{error}</p>}
          <button type="button" className="btn-secondary w-full" onClick={onClose}>
            Назад
          </button>
        </form>
      </div>
    </div>
  );
}

