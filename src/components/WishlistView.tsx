"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProgressBar } from "@/components/ProgressBar";
import { PublicListBadge } from "@/components/WinDecor";
import { DecorImage } from "@/components/DecorImage";
import Image from "next/image";
import { formatPercent, formatRub, itemFundingPercent, amountForSplitIndex } from "@/lib/money";
import { useWishlistRealtime } from "@/hooks/useWishlistRealtime";
import { useNetwork } from "@/components/NetworkProvider";
import {
  ITEM_IMAGE_MAX_INPUT_BYTES,
  blobToDataUrl,
  compressItemImageFile,
} from "@/lib/avatar-image";

export type ClientItem = {
  id: string;
  name: string;
  price: string | number;
  imageUrl: string | null;
  productUrl: string | null;
  status: "AVAILABLE" | "RESERVED" | "FUNDING" | "CANCELLED";
  amountCollected: string | number;
  fundingMode?: "FREE" | "FIXED_SPLIT";
  splitParticipants?: number | null;
  splitAmountPerPerson?: string | number | null;
  reservationMessage?: string | null;
  reservationAnonymous?: boolean;
  reservedById: string | null;
  reservedBy?: { id: string; displayName: string; handle: string } | null;
  contributions?: {
    id: string;
    amount: string | number;
    message?: string | null;
    isAnonymous?: boolean;
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

  async function itemAction(
    itemId: string,
    action: string,
    extra?: {
      amount?: number;
      message?: string;
      anonymous?: boolean;
      fundingMode?: "FREE" | "FIXED_SPLIT";
      splitParticipants?: number;
    },
  ) {
    if (!requireOnline()) return;
    if (!currentUserId) {
      router.push(`/login?callbackUrl=/wishlist/${wishlist.id}`);
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
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
      <DecorImage
        src="/decor/envelope-pink.png"
        width={72}
        height={84}
        className="top-[72%] left-0 hidden w-12 opacity-90 lg:block"
      />
      <DecorImage
        src="/decor/star-pixel-pastel.png"
        width={48}
        height={48}
        className="right-2 top-8 hidden w-8 opacity-80 lg:block"
      />
      <DecorImage
        src="/decor/globe-icon.png"
        width={56}
        height={56}
        className="bottom-8 left-2 hidden w-12 opacity-85 lg:block"
      />
      <DecorImage
        src="/decor/cat-halftone-sitting.png"
        width={90}
        height={140}
        className="bottom-4 left-[62%] hidden w-16 -translate-x-1/2 opacity-90 xl:block"
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
                  src={item.imageUrl || "/decor/cat-halftone-portrait.png"}
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
                {item.productUrl && (
                  <a
                    href={item.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pixel-font mt-2 inline-block text-[10px] underline underline-offset-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Открыть товар ↗
                  </a>
                )}
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
          onReserve={(opts) =>
            itemAction(selected.id, "reserve", {
              message: opts?.message,
              anonymous: opts?.anonymous,
            })
          }
          onUnreserve={() => itemAction(selected.id, "unreserve")}
          onContribute={(opts) =>
            itemAction(selected.id, "contribute", {
              amount: opts.amount,
              message: opts.message,
              anonymous: opts.anonymous,
            })
          }
          onStartFunding={(opts) =>
            itemAction(selected.id, "start_funding", {
              fundingMode: opts.fundingMode,
              splitParticipants: opts.splitParticipants,
            })
          }
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

function MessageFields({
  message,
  anonymous,
  onMessage,
  onAnonymous,
}: {
  message: string;
  anonymous: boolean;
  onMessage: (v: string) => void;
  onAnonymous: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="pixel-font block text-xs">Сообщение (необязательно)</label>
      <textarea
        className="input-field min-h-[4.5rem] resize-y"
        maxLength={200}
        placeholder="Поздравление или пожелание…"
        value={message}
        onChange={(e) => onMessage(e.target.value)}
      />
      <label className="mono-font flex items-center gap-2 text-base">
        <input
          type="checkbox"
          className="h-4 w-4 accent-black"
          checked={anonymous}
          onChange={(e) => onAnonymous(e.target.checked)}
        />
        Отправить анонимно
      </label>
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
  onReserve: (opts?: { message?: string; anonymous?: boolean }) => void;
  onUnreserve: () => void;
  onContribute: (opts: {
    amount?: number;
    message?: string;
    anonymous?: boolean;
  }) => void;
  onStartFunding: (opts: {
    fundingMode: "FREE" | "FIXED_SPLIT";
    splitParticipants?: number;
  }) => void;
  onStopFunding: () => void;
}) {
  const [chipIn, setChipIn] = useState(false);
  const [reserveForm, setReserveForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [fundingModePick, setFundingModePick] = useState<"FREE" | "FIXED_SPLIT">(
    "FREE",
  );
  const [splitN, setSplitN] = useState("3");
  const [showStartOptions, setShowStartOptions] = useState(false);
  const { online, requireOnline } = useNetwork();

  const fundingPct = itemFundingPercent(item.amountCollected, item.price);
  const isFixed = item.fundingMode === "FIXED_SPLIT";
  const splitTotal = item.splitParticipants ?? 0;
  const contribCount = item.contributorCount ?? item.contributions?.length ?? 0;
  const splitFull = isFixed && splitTotal > 0 && contribCount >= splitTotal;
  const alreadyJoined =
    isFixed &&
    Boolean(currentUserId) &&
    (item.contributions ?? []).some((c) => c.user.id === currentUserId);
  const nextSplitAmount =
    isFixed && splitTotal > 0
      ? amountForSplitIndex(Number(item.price), splitTotal, contribCount)
      : Number(item.splitAmountPerPerson ?? 0);

  const isFunding =
    item.status === "FUNDING" || Number(item.amountCollected) > 0 || chipIn;

  // Guests know their own reservation via reservedById matching
  const isMyReserve =
    Boolean(currentUserId) && item.reservedById === currentUserId;

  function resetMsg() {
    setMessage("");
    setAnonymous(false);
  }

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
        {item.productUrl && (
          <p className="mb-4 text-center">
            <a
              href={item.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pixel-font text-xs underline underline-offset-4"
            >
              Открыть товар ↗
            </a>
          </p>
        )}

        {/* Owner aggregate view */}
        {isOwner && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="hard-border h-28 w-28 shrink-0 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl || "/decor/cat-halftone-portrait.png"}
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
                {isFixed && splitTotal > 0 && (
                  <p className="mono-font mt-2 text-base">
                    Скинулись: {contribCount} из {splitTotal}
                    {item.splitAmountPerPerson != null && (
                      <> · по {formatRub(Number(item.splitAmountPerPerson))}</>
                    )}
                  </p>
                )}
                <p className="mono-font mt-2 text-base text-[#666]">
                  Участники скрыты — сюрприз!
                </p>
                {item.status === "RESERVED" && item.reservationMessage && (
                  <p className="mono-font mt-2 text-base leading-snug">
                    {item.reservationAnonymous ? "Аноним" : "Сообщение"}: «
                    {item.reservationMessage}»
                  </p>
                )}
              </div>
            </div>

            {showStartOptions && item.status !== "FUNDING" ? (
              <div className="space-y-3">
                <p className="pixel-font text-xs">Режим сбора</p>
                <label className="mono-font flex items-center gap-2 text-lg">
                  <input
                    type="radio"
                    name="fundingMode"
                    checked={fundingModePick === "FREE"}
                    onChange={() => setFundingModePick("FREE")}
                  />
                  Свободный сбор
                </label>
                <label className="mono-font flex items-center gap-2 text-lg">
                  <input
                    type="radio"
                    name="fundingMode"
                    checked={fundingModePick === "FIXED_SPLIT"}
                    onChange={() => setFundingModePick("FIXED_SPLIT")}
                  />
                  Складчина на N человек
                </label>
                {fundingModePick === "FIXED_SPLIT" && (
                  <div>
                    <label className="pixel-font mb-1 block text-xs">
                      Число участников
                    </label>
                    <input
                      type="number"
                      min={2}
                      step={1}
                      className="input-field"
                      value={splitN}
                      onChange={(e) => setSplitN(e.target.value)}
                    />
                    {Number(splitN) >= 2 && (
                      <p className="mono-font mt-1 text-base text-[#555]">
                        С каждого ≈{" "}
                        {formatRub(
                          Math.ceil(Number(item.price) / Number(splitN)),
                        )}
                      </p>
                    )}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="btn-primary flex-1"
                    disabled={
                      busy ||
                      !online ||
                      (fundingModePick === "FIXED_SPLIT" &&
                        (!Number.isInteger(Number(splitN)) || Number(splitN) < 2))
                    }
                    onClick={() => {
                      onStartFunding({
                        fundingMode: fundingModePick,
                        splitParticipants:
                          fundingModePick === "FIXED_SPLIT"
                            ? Number(splitN)
                            : undefined,
                      });
                      setShowStartOptions(false);
                    }}
                  >
                    Запустить
                  </button>
                  <button
                    type="button"
                    className="btn-secondary flex-1"
                    onClick={() => setShowStartOptions(false)}
                  >
                    Назад
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                {item.status !== "FUNDING" ? (
                  <button
                    type="button"
                    disabled={busy || item.status === "RESERVED" || !online}
                    title={!online ? "Нет соединения" : undefined}
                    className="btn-primary flex-1"
                    onClick={() => setShowStartOptions(true)}
                  >
                    Начать сбор денег
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
            )}
          </div>
        )}

        {/* Guest funding / contribute list */}
        {!isOwner && isFunding && !chipIn && item.status !== "RESERVED" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="hard-border h-32 w-32 shrink-0 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl || "/decor/cat-halftone-portrait.png"}
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
                {isFixed && splitTotal > 0 && (
                  <p className="mono-font mt-2 text-base">
                    Скинулись: {contribCount} из {splitTotal}
                  </p>
                )}
              </div>
            </div>

            <div className="relative space-y-2 pl-0 sm:pl-2">
              <DecorImage
                src="/decor/cat-halftone-face.png"
                width={72}
                height={80}
                className="-left-10 top-2 hidden w-14 opacity-90 xl:block"
              />
              <div className="relative z-10 space-y-2">
                {(item.contributions ?? []).map((c, idx) => (
                  <div key={c.id} className="relative z-10">
                    <div className="leader-row">
                      <span>
                        {idx + 1}. {c.user.displayName}
                        {idx === 0 ? " 💛" : ""}
                      </span>
                      <span className="leader-dots" />
                      <span>{formatRub(Number(c.amount))}</span>
                    </div>
                    {c.message && (
                      <p className="mono-font mt-1 ml-4 border-l-2 border-black pl-2 text-base leading-snug text-[#444]">
                        «{c.message}»
                      </p>
                    )}
                  </div>
                ))}
                {(item.contributions ?? []).length === 0 && (
                  <p className="mono-font text-lg text-[#777]">Пока никто не скинулся</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              {splitFull || fundingPct >= 100 ? (
                <p className="mono-font flex-1 self-center text-center text-lg">
                  Складчина уже набрана
                </p>
              ) : alreadyJoined ? (
                <p className="mono-font flex-1 self-center text-center text-lg">
                  Вы уже участвуете
                </p>
              ) : (
                <button
                  type="button"
                  className="btn-primary flex-1"
                  disabled={busy || !online}
                  title={!online ? "Нет соединения" : undefined}
                  onClick={() => {
                    if (!requireOnline()) return;
                    setChipIn(true);
                    resetMsg();
                  }}
                >
                  Скинуться
                </button>
              )}
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
          !reserveForm &&
          Number(item.amountCollected) === 0 && (
            <div className="space-y-5">
              <div className="mx-auto hard-border h-48 w-48 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl || "/decor/cat-halftone-portrait.png"}
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
                  onClick={() => {
                    if (!requireOnline()) return;
                    setReserveForm(true);
                    resetMsg();
                  }}
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
                    resetMsg();
                  }}
                >
                  Скинуться
                </button>
              </div>
            </div>
          )}

        {/* Reserve with optional message */}
        {!isOwner && reserveForm && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!requireOnline()) return;
              onReserve({
                message: message.trim() || undefined,
                anonymous,
              });
              setReserveForm(false);
              resetMsg();
            }}
          >
            <p className="pixel-font text-center text-sm">Зарезервировать подарок</p>
            <MessageFields
              message={message}
              anonymous={anonymous}
              onMessage={setMessage}
              onAnonymous={setAnonymous}
            />
            <div className="flex gap-3">
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={busy || !online}
              >
                Подтвердить
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => {
                  setReserveForm(false);
                  resetMsg();
                }}
              >
                Назад
              </button>
            </div>
          </form>
        )}

        {/* Reserved by someone */}
        {!isOwner && item.status === "RESERVED" && !reserveForm && (
          <div className="space-y-4 text-center">
            <div className="mx-auto hard-border h-48 w-48 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl || "/decor/cat-halftone-portrait.png"}
                alt=""
                className="h-full w-full object-cover grayscale"
              />
            </div>
            <p className="mono-font text-xl">
              Забронировано
              {item.reservedBy ? `: ${item.reservedBy.displayName}` : ""}
            </p>
            {item.reservationMessage && (
              <p className="mono-font text-base leading-snug">
                «{item.reservationMessage}»
              </p>
            )}
            {isMyReserve ? (
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

        {/* Chip-in form */}
        {chipIn && !isOwner && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!requireOnline()) return;
              if (isFixed) {
                onContribute({
                  message: message.trim() || undefined,
                  anonymous,
                });
              } else {
                const n = Number(amount);
                if (!n) return;
                onContribute({
                  amount: n,
                  message: message.trim() || undefined,
                  anonymous,
                });
              }
              setChipIn(false);
              setAmount("");
              resetMsg();
            }}
          >
            {isFixed ? (
              <p className="pixel-font text-center text-sm">
                С вас: {formatRub(nextSplitAmount)}
              </p>
            ) : (
              <>
                <p className="pixel-font text-center text-sm">Сколько скинуть?</p>
                <input
                  className="input-field"
                  inputMode="decimal"
                  placeholder="Сумма ₽"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </>
            )}
            <MessageFields
              message={message}
              anonymous={anonymous}
              onMessage={setMessage}
              onAnonymous={setAnonymous}
            />
            <div className="flex gap-3">
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={busy || !online}
                title={!online ? "Нет соединения" : undefined}
              >
                Скинуться
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => {
                  setChipIn(false);
                  resetMsg();
                }}
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
  const [name, setName] = useState(item?.name ?? "");
  const [price, setPrice] = useState(item ? String(Number(item.price)) : "");
  const [productUrl, setProductUrl] = useState(item?.productUrl ?? "");
  const [preview, setPreview] = useState<string | null>(item?.imageUrl ?? null);
  const { online, requireOnline } = useNetwork();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireOnline()) return;
    setLoading(true);
    setError(null);
    const trimmedName = name.trim();
    const priceNum = Number(price);
    const trimmedUrl = productUrl.trim();

    if (!trimmedName || Number.isNaN(priceNum) || priceNum < 0) {
      setLoading(false);
      setError("Укажите название и цену");
      return;
    }

    if (editing && item) {
      const priceChanging = priceNum !== Number(item.price);
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
          name: trimmedName,
          price: priceNum,
          imageUrl: preview,
          productUrl: trimmedUrl || null,
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

    const res = await fetch(`/api/wishlists/${wishlistId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmedName,
        price: priceNum,
        imageUrl: preview,
        productUrl: trimmedUrl || null,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка");
      return;
    }
    onDone();
  }

  async function onFile(file?: File | null) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Можно загрузить только изображение");
      return;
    }
    if (file.size > ITEM_IMAGE_MAX_INPUT_BYTES) {
      setError("Файл слишком большой, попробуйте другое фото");
      return;
    }
    try {
      const compressed = await compressItemImageFile(file);
      const dataUrl = await blobToDataUrl(compressed);
      setPreview(dataUrl);
    } catch {
      setError("Не удалось обработать изображение");
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel relative overflow-visible" onClick={(e) => e.stopPropagation()}>
        {!editing && (
          <>
            <Image
              src="/decor/hourglass-icon.png"
              alt=""
              width={48}
              height={84}
              quality={70}
              draggable={false}
              className="pointer-events-none absolute -top-10 -left-4 z-20 hidden w-10 rotate-[-6deg] md:block"
            />
            <Image
              src="/decor/star-sparkle-navy.png"
              alt=""
              width={64}
              height={64}
              quality={70}
              draggable={false}
              className="pointer-events-none absolute -top-4 -right-8 z-20 hidden w-14 md:block"
            />
            <Image
              src="/decor/windows-explorer-window.png"
              alt=""
              width={180}
              height={166}
              quality={70}
              draggable={false}
              className="pointer-events-none absolute -right-12 -bottom-20 z-20 hidden w-36 rotate-3 opacity-95 md:block"
            />
            <Image
              src="/decor/star-pixel-pastel.png"
              alt=""
              width={48}
              height={48}
              quality={70}
              draggable={false}
              className="pointer-events-none absolute -bottom-6 -left-8 z-20 hidden w-10 md:block"
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
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
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="pixel-font mb-2 block text-xs">Ссылка на товар</label>
            <input
              name="productUrl"
              className="input-field"
              placeholder="https://..."
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
            />
            <p className="mono-font mt-2 text-xs leading-snug opacity-60">
              Ссылка на товар (необязательно) — откроется в новой вкладке
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="btn-secondary inline-flex cursor-pointer text-xs">
              Загрузить своё фото
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt=""
                className="hard-border h-16 w-16 object-cover"
                referrerPolicy="no-referrer"
              />
            )}
          </div>

          {error && <p className="mono-font text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !online}
            className="btn-primary w-full py-3"
            title={!online ? "Нет соединения" : undefined}
          >
            {editing ? "Сохранить изменения" : "+ Добавить предмет"}
          </button>
          <button type="button" className="btn-secondary w-full" onClick={onClose}>
            Назад
          </button>
        </form>
      </div>
    </div>
  );
}

