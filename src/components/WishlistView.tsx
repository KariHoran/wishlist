"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProgressBar } from "@/components/ProgressBar";
import { PublicListBadge, WinExplorer, WinLoading } from "@/components/WinDecor";
import { formatPercent, formatRub, itemFundingPercent } from "@/lib/money";
import { useWishlistRealtime } from "@/hooks/useWishlistRealtime";

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
  useWishlistRealtime(wishlist.id);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
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
    <div className="relative">
      {isGuestView && <PublicListBadge />}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/envelope.svg"
        alt=""
        className="pointer-events-none absolute top-28 left-2 z-0 hidden w-14 md:block"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/notepad.svg"
        alt=""
        className="pointer-events-none absolute right-4 bottom-24 z-0 hidden w-12 md:block"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/pixel-star.svg"
        alt=""
        className="pointer-events-none absolute bottom-40 left-1/2 z-0 hidden w-8 -translate-x-1/2 md:block"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/halftone-cat.svg"
        alt=""
        className="pointer-events-none absolute bottom-8 left-[55%] z-0 hidden w-14 md:block"
      />

      <div className="relative z-10 mb-4 flex flex-wrap items-start justify-between gap-3">
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
              onClick={() => togglePublic()}
              disabled={busy}
              className="pixel-font text-xs underline underline-offset-4 leading-normal md:text-sm"
            >
              {wishlist.isPublic ? "Сделать личным" : "Сделать публичным"}
            </button>
            <button
              type="button"
              onClick={() => deleteWishlist()}
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
                <button
                  type="button"
                  className="absolute top-1 right-2 z-10 text-lg leading-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteItem(item.id);
                  }}
                  aria-label="Удалить"
                >
                  ✕
                </button>
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
          <button type="button" className="btn-primary px-8" onClick={() => setAddOpen(true)}>
            + Добавить предметы
          </button>
        </div>
      )}

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
        <AddItemModal
          wishlistId={wishlist.id}
          onClose={() => setAddOpen(false)}
          onDone={() => {
            setAddOpen(false);
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
                  disabled={busy || item.status === "RESERVED"}
                  className="btn-primary flex-1"
                  onClick={onStartFunding}
                >
                  Начать сбор
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
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
                className="pointer-events-none absolute -left-2 top-0 hidden w-16 opacity-40 sm:block"
              />
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

            <div className="flex gap-3">
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={busy}
                onClick={() => setChipIn(true)}
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
                disabled={busy}
                onClick={onReserve}
              >
                Зарезервировать
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                disabled={busy}
                onClick={() => setChipIn(true)}
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
                disabled={busy}
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
              <button type="submit" className="btn-primary flex-1" disabled={busy}>
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

function AddItemModal({
  wishlistId,
  onClose,
  onDone,
}: {
  wishlistId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const productUrl = String(fd.get("productUrl") ?? "").trim();
    const name = String(fd.get("name") ?? "").trim();
    const price = fd.get("price");

    const body =
      productUrl && !name
        ? { productUrl }
        : {
            name,
            price: Number(price),
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

        <h2 className="display-font mb-5 text-center text-sm md:text-base">
          Добавить новый предмет
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="pixel-font mb-2 block text-xs">Название предмета</label>
            <input name="name" className="input-field" />
          </div>
          <div>
            <label className="pixel-font mb-2 block text-xs">Цена</label>
            <input name="price" type="number" min="0" step="1" className="input-field" />
          </div>
          <label className="btn-primary inline-flex cursor-pointer text-xs">
            + Загрузить изображение
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
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            + Добавить предмет
          </button>
          <p className="pixel-font text-center text-xs">Или</p>
          <div>
            <label className="pixel-font mb-2 block text-xs">Вставить ссылку</label>
            <input name="productUrl" className="input-field" placeholder="https://..." />
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
