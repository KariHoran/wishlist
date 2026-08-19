"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ProgressBar } from "@/components/ProgressBar";
import { PublicListBadge } from "@/components/WinDecor";
import { DecorImage } from "@/components/DecorImage";
import Image from "next/image";
import { formatPercent, formatCurrency, itemFundingPercent, amountForSplitIndex } from "@/lib/money";
import {
  currencies,
  defaultCurrency,
  isCurrency,
  parseCurrency,
  type AppLocale,
  type WishlistCurrency,
} from "@/i18n/config";
import { wishlistHasFinancialActivity } from "@/lib/wishlist-currency";
import { useWishlistRealtime } from "@/hooks/useWishlistRealtime";
import { useNetwork } from "@/components/NetworkProvider";
import {
  ITEM_IMAGE_MAX_INPUT_BYTES,
  blobToDataUrl,
  compressItemImageFile,
} from "@/lib/avatar-image";
import { RetroInlineState } from "@/components/RetroState";
import { ModalDialog } from "@/components/ModalDialog";

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
    currency: string;
    deadline?: string | null;
  };
  items: ClientItem[];
  isOwner: boolean;
  isGuestView: boolean;
  currentUserId?: string;
  shareToken?: string;
};

function guestName(
  isAnonymous: boolean | undefined,
  displayName: string | undefined,
  anonymousLabel: string,
) {
  return isAnonymous || !displayName ? anonymousLabel : displayName;
}

export function WishlistView({
  wishlist,
  items,
  isOwner,
  isGuestView,
  currentUserId,
  shareToken,
}: Props) {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const currency = parseCurrency(wishlist.currency || defaultCurrency);
  const t = useTranslations("wishlist");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const tStatus = useTranslations("status");
  const fmt = (amount: number | string) => formatCurrency(amount, currency, locale);
  const { online, requireOnline } = useNetwork();
  useWishlistRealtime(wishlist.id);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState(items);
  const [optimisticPending, setOptimisticPending] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [editWishlistOpen, setEditWishlistOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [currentShareToken, setCurrentShareToken] = useState(shareToken ?? null);
  const [cancelModal, setCancelModal] = useState<{
    kind: "item" | "wishlist" | "private";
    itemId?: string;
    itemName?: string;
    contributorCount: number;
    totalAmount: number;
    itemCount?: number;
  } | null>(null);
  const currencyLocked = wishlistHasFinancialActivity(localItems);

  useEffect(() => {
    if (optimisticPending === 0) {
      const timer = window.setTimeout(() => setLocalItems(items), 0);
      return () => window.clearTimeout(timer);
    }
  }, [items, optimisticPending]);

  const visibleItems = localItems.filter((i) => i.status !== "CANCELLED");
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
        alert(tErrors("deleteFailed"));
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
      alert(tErrors("deleteFailed"));
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
      const prev = localItems;
      setLocalItems((list) => list.filter((i) => i.id !== id));
      setOptimisticPending((v) => v + 1);
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      setBusy(false);
      if (!res.ok) {
        setLocalItems(prev);
        setOptimisticPending((v) => Math.max(0, v - 1));
        alert(tErrors("deleteFailed"));
        return;
      }
      setOptimisticPending((v) => Math.max(0, v - 1));
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
      alert(tErrors("generic"));
      return;
    }
    router.refresh();
  }

  const copyShareLink = useCallback(async () => {
    const token = currentShareToken;
    if (!token) return;
    const url = `${window.location.origin}/w/${token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2500);
  }, [currentShareToken]);

  async function regenerateShareToken() {
    if (!requireOnline()) return;
    const res = await fetch(`/api/wishlists/${wishlist.id}/share-token`, {
      method: "POST",
    });
    if (!res.ok) {
      alert(tErrors("shareRefreshFailed"));
      return;
    }
    const data = await res.json() as { shareToken: string };
    setCurrentShareToken(data.shareToken);
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2500);
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
      const redirect = shareToken
        ? `/w/${shareToken}`
        : `/wishlist/${wishlist.id}`;
      router.push(`/register?redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    const prev = localItems;
    if (action === "reserve") {
      setLocalItems((list) =>
        list.map((it) =>
          it.id !== itemId
            ? it
            : {
                ...it,
                status: "RESERVED",
                reservedById: currentUserId ?? it.reservedById,
                reservationMessage: extra?.message ?? null,
                reservationAnonymous: Boolean(extra?.anonymous),
              },
        ),
      );
      setOptimisticPending((v) => v + 1);
    } else if (action === "unreserve") {
      setLocalItems((list) =>
        list.map((it) =>
          it.id !== itemId
            ? it
            : {
                ...it,
                status: "AVAILABLE",
                reservedById: null,
                reservationMessage: null,
                reservationAnonymous: false,
              },
        ),
      );
      setOptimisticPending((v) => v + 1);
    } else if (action === "contribute") {
      setLocalItems((list) =>
        list.map((it) =>
          it.id !== itemId
            ? it
            : {
                ...it,
                status: "FUNDING",
                amountCollected:
                  Number(it.amountCollected) +
                  Number(
                    extra?.amount ??
                      (it.fundingMode === "FIXED_SPLIT"
                        ? it.splitAmountPerPerson ?? 0
                        : 0),
                  ),
              },
        ),
      );
      setOptimisticPending((v) => v + 1);
    } else if (action === "start_funding") {
      setLocalItems((list) =>
        list.map((it) =>
          it.id !== itemId
            ? it
            : {
                ...it,
                status: "FUNDING",
                fundingMode: extra?.fundingMode ?? "FREE",
                splitParticipants: extra?.splitParticipants ?? null,
                splitAmountPerPerson:
                  extra?.fundingMode === "FIXED_SPLIT" && extra.splitParticipants
                    ? Math.ceil(Number(it.price) / extra.splitParticipants)
                    : null,
              },
        ),
      );
      setOptimisticPending((v) => v + 1);
    } else if (action === "stop_funding") {
      setLocalItems((list) =>
        list.map((it) =>
          it.id !== itemId
            ? it
            : {
                ...it,
                status: Number(it.amountCollected) > 0 ? "FUNDING" : "AVAILABLE",
                fundingMode: "FREE",
                splitParticipants: null,
                splitAmountPerPerson: null,
              },
        ),
      );
      setOptimisticPending((v) => v + 1);
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
      if (
        action === "reserve" ||
        action === "unreserve" ||
        action === "contribute" ||
        action === "start_funding" ||
        action === "stop_funding"
      ) {
        setLocalItems(prev);
        setOptimisticPending((v) => Math.max(0, v - 1));
      }
      alert(data.error ?? tErrors("generic"));
      return;
    }
    if (
      action === "reserve" ||
      action === "unreserve" ||
      action === "contribute" ||
      action === "start_funding" ||
      action === "stop_funding"
    ) {
      setOptimisticPending((v) => Math.max(0, v - 1));
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
          {t("backToLists")}
        </Link>
        {isOwner && (
          <div className="flex max-w-full flex-wrap items-start justify-end gap-x-2 gap-y-1 md:gap-x-3">
            <button
              type="button"
              onClick={() => {
                if (!requireOnline()) return;
                setEditWishlistOpen(true);
              }}
              disabled={!online}
              title={!online ? tCommon("noConnection") : undefined}
              className="pixel-font text-[10px] underline underline-offset-4 leading-normal md:text-xs"
            >
              {t("edit")}
            </button>
            <button
              type="button"
              onClick={() => togglePublic()}
              disabled={busy || !online}
              title={!online ? tCommon("noConnection") : undefined}
              className="pixel-font text-[10px] underline underline-offset-4 leading-normal md:text-xs"
            >
              {wishlist.isPublic ? t("makePrivate") : t("makePublic")}
            </button>
            {wishlist.isPublic && currentShareToken && (
              <>
                <button
                  type="button"
                  onClick={() => void copyShareLink()}
                  className="pixel-font text-[10px] underline underline-offset-4 leading-normal md:text-xs"
                  title={t("copyLinkTitle")}
                >
                  {shareToast ? t("copied") : t("copyLink")}
                </button>
                <button
                  type="button"
                  onClick={() => void regenerateShareToken()}
                  disabled={!online}
                  className="pixel-font text-[10px] text-[#888] underline underline-offset-4 leading-normal md:text-xs"
                  title={t("refreshLinkTitle")}
                >
                  {t("refreshLink")}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => deleteWishlist()}
              disabled={!online}
              title={!online ? tCommon("noConnection") : undefined}
              className="pixel-font text-[10px] text-[#666] underline underline-offset-4 leading-normal md:text-xs"
            >
              {t("deleteList")}
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
          <span className="pixel-font text-sm">{t("progress")}</span>
          <span className="mono-font text-lg">
            {t("progressCounts", {
              collected: collectedCount,
              total: visibleItems.length,
              percent,
            })}
          </span>
        </div>
        <ProgressBar percent={percent} segmented height={22} />
      </div>

      {visibleItems.length === 0 ? (
        <div className="mt-6">
          <RetroInlineState
            title={isOwner ? t("emptyOwnerTitle") : t("emptyGuestTitle")}
            message={isOwner ? t("emptyOwnerMessage") : t("emptyGuestMessage")}
            actionLabel={isOwner ? t("addItems") : undefined}
            onAction={
              isOwner
                ? () => {
                    setAddOpen(true);
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {visibleItems.map((item, itemIndex) => {
          const statusLabel =
            item.status === "RESERVED"
              ? tStatus("RESERVED")
              : item.status === "FUNDING"
                ? tStatus("cardFunding")
                : tStatus("cardWaiting");
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
                    title={!online ? tCommon("noConnection") : tCommon("edit")}
                    aria-label={tCommon("edit")}
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
                    title={!online ? tCommon("noConnection") : tCommon("delete")}
                    aria-label={tCommon("delete")}
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className="relative aspect-square border-b-2 border-black bg-[#eee]">
                <Image
                  src={item.imageUrl || "/decor/cat-halftone-portrait.png"}
                  alt={t("giftPhotoAlt", { name: item.name })}
                  fill
                  sizes="(max-width: 768px) 100vw, 200px"
                  // First cards are LCP on wishlist grid — don't lazy-load them
                  priority={itemIndex < 2}
                  className={`object-cover ${item.status === "RESERVED" ? "grayscale" : ""}`}
                />
              </div>
              <div className="p-3">
                <p className="pixel-font text-xs leading-relaxed">{item.name}</p>
                <p className="mono-font text-xl">{fmt(Number(item.price))}</p>
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
                    {t("openProduct")}
                  </a>
                )}
              </div>
            </article>
          );
          })}
        </div>
      )}

      {isOwner && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            className="btn-primary px-8"
            disabled={!online}
            title={!online ? tCommon("noConnection") : undefined}
            onClick={() => {
              if (!requireOnline()) return;
              setAddOpen(true);
            }}
          >
            {t("addItems")}
          </button>
        </div>
      )}
      </div>

      {cancelModal && (
        <ModalDialog onClose={() => setCancelModal(null)}>
            <h2 className="display-font mb-4 text-center text-sm">{tCommon("attention")}</h2>
            {cancelModal.kind === "item" ? (
              <p className="mono-font mb-4 text-lg leading-relaxed">
                {t("cancelItemBody", {
                  itemName: cancelModal.itemName ?? "",
                  contributorCount: cancelModal.contributorCount,
                  amount: fmt(cancelModal.totalAmount),
                })}
              </p>
            ) : cancelModal.kind === "private" ? (
              <p className="mono-font mb-4 text-lg leading-relaxed">
                {t("confirmMakePrivate", { itemCount: cancelModal.itemCount ?? 0 })}
              </p>
            ) : (
              <p className="mono-font mb-4 text-lg leading-relaxed">
                {t("cancelListBody", {
                  itemCount: cancelModal.itemCount ?? 0,
                  contributorCount: cancelModal.contributorCount,
                  amount: fmt(cancelModal.totalAmount),
                })}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={busy}
                onClick={confirmCancelModal}
              >
                {tCommon("continue")}
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setCancelModal(null)}
              >
                {tCommon("back")}
              </button>
            </div>
        </ModalDialog>
      )}

      {selected && (
        <ItemModal
          item={selected}
          currency={currency}
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
          currencyLocked={currencyLocked}
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
  const t = useTranslations("item");
  return (
    <div className="space-y-2">
      <label htmlFor="item-message" className="pixel-font block text-xs">{t("messageLabel")}</label>
      <textarea
        id="item-message"
        className="input-field min-h-[4.5rem] resize-y"
        maxLength={200}
        placeholder={t("messagePlaceholder")}
        value={message}
        onChange={(e) => onMessage(e.target.value)}
      />
      <label htmlFor="item-message-anon" className="mono-font flex items-center gap-2 text-base">
        <input
          id="item-message-anon"
          type="checkbox"
          className="h-4 w-4 accent-black"
          checked={anonymous}
          onChange={(e) => onAnonymous(e.target.checked)}
        />
        {t("sendAnonymous")}
      </label>
    </div>
  );
}

function ItemModal({
  item,
  currency,
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
  currency: WishlistCurrency;
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
  const locale = useLocale() as AppLocale;
  const t = useTranslations("item");
  const tWishlist = useTranslations("wishlist");
  const tCommon = useTranslations("common");
  const fmt = (amount: number | string) => formatCurrency(amount, currency, locale);
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
    <ModalDialog onClose={onClose}>
      <div className={`mb-4 flex items-start gap-2 ${isGuestView ? "" : "justify-end"}`}>
        {isGuestView && (
          <div className="min-w-0 flex-1">
            <PublicListBadge variant="modal" />
          </div>
        )}
        <button
          type="button"
          className="hard-border flex h-8 w-8 shrink-0 items-center justify-center bg-white text-xl leading-none"
          onClick={onClose}
          aria-label={tCommon("close")}
        >
          ✕
        </button>
      </div>
        <h2 className="display-font mb-4 text-center text-sm leading-relaxed md:text-base">
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
              {tWishlist("openProduct")}
            </a>
          </p>
        )}

        {/* Owner aggregate view */}
        {isOwner && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="relative hard-border h-28 w-28 shrink-0 overflow-hidden">
                <Image
                  src={item.imageUrl || "/decor/cat-halftone-portrait.png"}
                  alt={tWishlist("giftPhotoAlt", { name: item.name })}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </div>
              <div className="flex-1">
                <p className="mono-font text-lg">
                  {t("collectedPercent", { percent: formatPercent(fundingPct, locale, 2) })}
                </p>
                <p className="display-font text-xl">{fmt(Number(item.price))}</p>
                <div className="mt-2">
                  <ProgressBar percent={fundingPct} height={14} />
                </div>
                {isFixed && splitTotal > 0 && (
                  <p className="mono-font mt-2 text-base">
                    {t("splitProgress", { count: contribCount, total: splitTotal })}
                    {item.splitAmountPerPerson != null && (
                      <>{t("splitPerPerson", { amount: fmt(Number(item.splitAmountPerPerson)) })}</>
                    )}
                  </p>
                )}
                <p className="mono-font mt-2 text-base text-[#666]">
                  {t("surpriseParticipants")}
                </p>
                {item.status === "RESERVED" && item.reservationMessage && (
                  <p className="mono-font mt-2 text-base leading-snug">
                    {t("reservationNote", {
                      from: item.reservationAnonymous ? tCommon("anonymous") : t("messageFrom"),
                      message: item.reservationMessage,
                    })}
                  </p>
                )}
              </div>
            </div>

            {showStartOptions && item.status !== "FUNDING" ? (
              <div className="space-y-3">
                <p className="pixel-font text-xs">{t("fundingMode")}</p>
                <label className="mono-font flex items-center gap-2 text-lg">
                  <input
                    type="radio"
                    name="fundingMode"
                    checked={fundingModePick === "FREE"}
                    onChange={() => setFundingModePick("FREE")}
                  />
                  {t("freeFunding")}
                </label>
                <label className="mono-font flex items-center gap-2 text-lg">
                  <input
                    type="radio"
                    name="fundingMode"
                    checked={fundingModePick === "FIXED_SPLIT"}
                    onChange={() => setFundingModePick("FIXED_SPLIT")}
                  />
                  {t("fixedSplit")}
                </label>
                {fundingModePick === "FIXED_SPLIT" && (
                  <div>
                    <label
                      htmlFor="split-n"
                      className="pixel-font mb-1 block text-xs"
                    >
                      {t("splitCount")}
                    </label>
                    <input
                      id="split-n"
                      type="number"
                      min={2}
                      step={1}
                      className="input-field"
                      value={splitN}
                      onChange={(e) => setSplitN(e.target.value)}
                    />
                    {Number(splitN) >= 2 && (
                      <p className="mono-font mt-1 text-base text-[#555]">
                        {t("approxEach", {
                          amount: fmt(Math.ceil(Number(item.price) / Number(splitN))),
                        })}
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
                    {t("start")}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary flex-1"
                    onClick={() => setShowStartOptions(false)}
                  >
                    {tCommon("back")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                {item.status !== "FUNDING" ? (
                  <button
                    type="button"
                    disabled={busy || item.status === "RESERVED" || !online}
                    title={!online ? tCommon("noConnection") : undefined}
                    className="btn-primary flex-1"
                    onClick={() => setShowStartOptions(true)}
                  >
                    {t("startFunding")}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy || !online}
                    title={!online ? tCommon("noConnection") : undefined}
                    className="btn-secondary flex-1"
                    onClick={onStopFunding}
                  >
                    {t("stopFunding")}
                  </button>
                )}
                <button type="button" className="btn-secondary flex-1" onClick={onClose}>
                  {tCommon("back")}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Guest funding / contribute list */}
        {!isOwner && isFunding && !chipIn && item.status !== "RESERVED" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative hard-border h-32 w-32 shrink-0 overflow-hidden">
                <Image
                  src={item.imageUrl || "/decor/cat-halftone-portrait.png"}
                  alt={tWishlist("giftPhotoAlt", { name: item.name })}
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              </div>
              <div className="flex-1">
                <p className="mono-font text-lg">
                  {t("collectedPercent", { percent: formatPercent(fundingPct, locale, 2) })}
                </p>
                <p className="display-font text-2xl">{fmt(Number(item.price))}</p>
                <div className="mt-2">
                  <ProgressBar percent={fundingPct} height={14} />
                </div>
                {isFixed && splitTotal > 0 && (
                  <p className="mono-font mt-2 text-base">
                    {t("splitProgress", { count: contribCount, total: splitTotal })}
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
                        {idx + 1}.{" "}
                        {guestName(c.isAnonymous, c.user.displayName, tCommon("anonymous"))}
                        {idx === 0 ? " 💛" : ""}
                      </span>
                      <span className="leader-dots" />
                      <span>{fmt(Number(c.amount))}</span>
                    </div>
                    {c.message && (
                      <p className="mono-font mt-1 ml-4 border-l-2 border-black pl-2 text-base leading-snug text-[#444]">
                        «{c.message}»
                      </p>
                    )}
                  </div>
                ))}
                {(item.contributions ?? []).length === 0 && (
                  <p className="mono-font text-lg text-[#777]">{t("nobodyYet")}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              {splitFull || fundingPct >= 100 ? (
                <p className="mono-font flex-1 self-center text-center text-lg">
                  {t("splitFull")}
                </p>
              ) : alreadyJoined ? (
                <p className="mono-font flex-1 self-center text-center text-lg">
                  {t("alreadyJoined")}
                </p>
              ) : (
                <button
                  type="button"
                  className="btn-primary flex-1"
                  disabled={busy || !online}
                  title={!online ? tCommon("noConnection") : undefined}
                  onClick={() => {
                    if (!requireOnline()) return;
                    setChipIn(true);
                    resetMsg();
                  }}
                >
                  {t("chipIn")}
                </button>
              )}
              <button type="button" className="btn-secondary flex-1" onClick={onClose}>
                {tCommon("back")}
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
              <div className="relative mx-auto hard-border h-48 w-48 overflow-hidden">
                <Image
                  src={item.imageUrl || "/decor/cat-halftone-portrait.png"}
                  alt={tWishlist("giftPhotoAlt", { name: item.name })}
                  fill
                  sizes="192px"
                  className="object-cover"
                />
              </div>
              <p className="display-font text-center text-2xl">
                {fmt(Number(item.price))}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn-primary flex-1"
                  disabled={busy || !online}
                  title={!online ? tCommon("noConnection") : undefined}
                  onClick={() => {
                    if (!requireOnline()) return;
                    setReserveForm(true);
                    resetMsg();
                  }}
                >
                  {t("reserve")}
                </button>
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  disabled={busy || !online}
                  title={!online ? tCommon("noConnection") : undefined}
                  onClick={() => {
                    if (!requireOnline()) return;
                    setChipIn(true);
                    resetMsg();
                  }}
                >
                  {t("chipIn")}
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
            <p className="pixel-font text-center text-sm">{t("reserveTitle")}</p>
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
                {t("confirm")}
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => {
                  setReserveForm(false);
                  resetMsg();
                }}
              >
                {tCommon("back")}
              </button>
            </div>
          </form>
        )}

        {/* Reserved by someone */}
        {!isOwner && item.status === "RESERVED" && !reserveForm && (
          <div className="space-y-4 text-center">
            <div className="relative mx-auto hard-border h-48 w-48 overflow-hidden">
              <Image
                src={item.imageUrl || "/decor/cat-halftone-portrait.png"}
                alt={tWishlist("giftPhotoAlt", { name: item.name })}
                fill
                sizes="192px"
                className="object-cover grayscale"
              />
            </div>
            <p className="mono-font text-xl">
              {item.reservedBy
                ? t("reservedBy", {
                    name: guestName(
                      item.reservationAnonymous,
                      item.reservedBy.displayName,
                      tCommon("anonymous"),
                    ),
                  })
                : t("reserved")}
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
                title={!online ? tCommon("noConnection") : undefined}
                onClick={onUnreserve}
              >
                {t("unreserve")}
              </button>
            ) : (
              <button type="button" className="btn-secondary w-full" onClick={onClose}>
                {tCommon("back")}
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
                {t("yourShare", { amount: fmt(nextSplitAmount) })}
              </p>
            ) : (
              <>
                <label
                  htmlFor="chip-amount"
                  className="pixel-font block text-center text-sm"
                >
                  {t("howMuch")}
                </label>
                <input
                  id="chip-amount"
                  className="input-field"
                  inputMode="decimal"
                  placeholder={t("amountPlaceholder")}
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
                title={!online ? tCommon("noConnection") : undefined}
              >
                {t("chipIn")}
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => {
                  setChipIn(false);
                  resetMsg();
                }}
              >
                {tCommon("back")}
              </button>
            </div>
          </form>
        )}
    </ModalDialog>
  );
}


function EditWishlistModal({
  wishlist,
  currencyLocked,
  onClose,
  onDone,
}: {
  wishlist: {
    id: string;
    title: string;
    isPublic: boolean;
    currency: string;
    deadline?: string | null;
  };
  currencyLocked: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { online, requireOnline } = useNetwork();
  const t = useTranslations("wishlistForm");
  const tWishlist = useTranslations("wishlist");
  const tCurrency = useTranslations("currency");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const currentCurrency = parseCurrency(wishlist.currency || defaultCurrency);

  function patchBody(
    fd: FormData,
    extra?: { isPublic?: boolean; confirm?: boolean },
  ) {
    const body: Record<string, unknown> = {
      title: fd.get("title"),
      deadline: fd.get("deadline") || null,
      isPublic: extra?.isPublic ?? fd.get("isPublic") === "on",
    };
    if (extra?.confirm) body.confirm = true;
    if (!currencyLocked) {
      const next = String(fd.get("currency") || currentCurrency);
      if (isCurrency(next) && next !== currentCurrency) {
        body.currency = next;
      }
    }
    return body;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireOnline()) return;
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/wishlists/${wishlist.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchBody(fd)),
    });
    let data = await res.json().catch(() => ({}));
    if (res.status === 409 && data.requiresConfirmation) {
      const ok = window.confirm(
        tWishlist("confirmMakePrivate", { itemCount: data.itemCount }),
      );
      if (!ok) {
        setLoading(false);
        return;
      }
      const retry = await fetch(`/api/wishlists/${wishlist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody(fd, { isPublic: false, confirm: true })),
      });
      data = await retry.json().catch(() => ({}));
      setLoading(false);
      if (!retry.ok) {
        setError(data.error ?? tErrors("generic"));
        return;
      }
      onDone();
      return;
    }
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? tErrors("generic"));
      return;
    }
    onDone();
  }

  return (
    <ModalDialog onClose={onClose}>
        <h2 className="display-font mb-4 text-center text-sm md:text-base">
          {t("editTitle")}
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="wishlist-edit-title" className="pixel-font mb-2 block text-xs">{t("name")}</label>
            <input
              id="wishlist-edit-title"
              name="title"
              required
              className="input-field"
              defaultValue={wishlist.title}
            />
          </div>
          <div>
            <label htmlFor="wishlist-edit-deadline" className="pixel-font mb-2 block text-xs">{t("deadline")}</label>
            <input
              id="wishlist-edit-deadline"
              name="deadline"
              type="date"
              className="input-field"
              defaultValue={wishlist.deadline ?? ""}
            />
          </div>
          <div>
            <label htmlFor="wishlist-edit-currency" className="pixel-font mb-2 block text-xs">
              {tCurrency("label")}
            </label>
            <select
              id="wishlist-edit-currency"
              name="currency"
              defaultValue={currentCurrency}
              disabled={currencyLocked}
              className="input-field"
              title={currencyLocked ? tCurrency("lockedShort") : undefined}
            >
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {tCurrency(code)}
                </option>
              ))}
            </select>
            <p className="mono-font mt-1 text-sm text-[#777]">
              {currencyLocked ? tCurrency("locked") : tCurrency("hint")}
            </p>
          </div>
          <label htmlFor="wishlist-edit-public" className="mono-font flex items-center gap-2 text-lg">
            <input
              id="wishlist-edit-public"
              type="checkbox"
              name="isPublic"
              className="h-4 w-4 accent-black"
              defaultChecked={wishlist.isPublic}
            />
            {t("publicList")}
          </label>
          {error && <p className="mono-font text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !online}
              className="btn-primary flex-1"
              title={!online ? tCommon("noConnection") : undefined}
            >
              {tCommon("save")}
            </button>
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>
              {tCommon("back")}
            </button>
          </div>
        </form>
    </ModalDialog>
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
  const t = useTranslations("itemForm");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");

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
      setError(tErrors("nameAndPrice"));
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
        const ok = window.confirm(t("confirmPriceChange"));
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
        setError(data.error ?? tErrors("generic"));
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
      setError(data.error ?? tErrors("generic"));
      return;
    }
    onDone();
  }

  async function onFile(file?: File | null) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError(tErrors("imageType"));
      return;
    }
    if (file.size > ITEM_IMAGE_MAX_INPUT_BYTES) {
      setError(tErrors("fileTooLarge"));
      return;
    }
    try {
      const compressed = await compressItemImageFile(file);
      const dataUrl = await blobToDataUrl(compressed);
      setPreview(dataUrl);
    } catch {
      setError(tErrors("imageProcessFailed"));
    }
  }

  return (
    <ModalDialog onClose={onClose} panelClassName="modal-panel relative overflow-visible">
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
          {editing ? t("editTitle") : t("addTitle")}
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="item-name" className="pixel-font mb-2 block text-xs">{t("name")}</label>
            <input
              id="item-name"
              name="name"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="item-price" className="pixel-font mb-2 block text-xs">{t("price")}</label>
            <input
              id="item-price"
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
            <label htmlFor="item-product-url" className="pixel-font mb-2 block text-xs">{t("productUrl")}</label>
            <input
              id="item-product-url"
              name="productUrl"
              className="input-field"
              placeholder="https://..."
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
            />
            <p className="mono-font mt-2 text-xs leading-snug opacity-60">
              {t("productUrlHint")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="btn-secondary inline-flex cursor-pointer text-xs">
              {t("uploadPhoto")}
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
              <Image
                src={preview}
                alt={t("photoPreviewAlt")}
                width={64}
                height={64}
                unoptimized={preview.startsWith("data:")}
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
            title={!online ? tCommon("noConnection") : undefined}
          >
            {editing ? t("submitEdit") : t("submitAdd")}
          </button>
          <button type="button" className="btn-secondary w-full" onClick={onClose}>
            {tCommon("back")}
          </button>
        </form>
    </ModalDialog>
  );
}

