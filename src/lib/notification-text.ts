import type { NotificationType } from "@prisma/client";
import { loadMessagesSync } from "@/i18n/load-messages";
import { formatCurrency } from "@/lib/money";
import type { AppLocale, WishlistCurrency } from "@/i18n/config";

export type NotificationPayload = {
  itemId?: string;
  itemName?: string;
  wishlistId?: string;
  wishlistTitle?: string;
  amount?: number;
  currency?: WishlistCurrency;
  actorName?: string;
  actorHandle?: string;
  contributionId?: string;
  refunded?: boolean;
  requestId?: string;
  message?: string;
  anonymous?: boolean;
};

function msg(
  locale: AppLocale,
  key: string,
  params: Record<string, string | number>,
): string {
  const messages = loadMessagesSync(locale) as {
    notifications?: Record<string, string>;
  };
  let text = messages.notifications?.[key] ?? key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(`{${k}}`, String(v));
  }
  return text;
}

export function formatNotificationText(
  type: NotificationType,
  payload: NotificationPayload,
  locale: AppLocale = "ru",
): string {
  const item = payload.itemName
    ? `«${payload.itemName}»`
    : msg(locale, "fallbackItem", {});
  const list = payload.wishlistTitle ? ` (${payload.wishlistTitle})` : "";
  const currency = payload.currency ?? "RUB";
  const amount =
    payload.amount != null
      ? formatCurrency(payload.amount, currency, locale)
      : "";
  const actor = payload.actorName ?? msg(locale, "someone", {});
  const rawMsg = payload.message?.trim();
  const messagePart = rawMsg
    ? payload.anonymous
      ? ` ${msg(locale, "anonymousPrefix", { message: rawMsg })}`
      : ` ${msg(locale, "messagePrefix", { message: rawMsg })}`
    : "";

  switch (type) {
    case "ITEM_RESERVED_BY_YOU":
      return msg(locale, "reservedByYou", { item, list });
    case "ITEM_RESERVED":
      return msg(locale, "itemReserved", { item, list, message: messagePart });
    case "ITEM_CONTRIBUTED":
      return amount
        ? msg(locale, "contributedWithAmount", {
            amount,
            item,
            list,
            message: messagePart,
          })
        : msg(locale, "contributed", { item, list, message: messagePart });
    case "ITEM_CANCELLED_REFUND_DUE":
      return msg(locale, "refundDue", { item, amount });
    case "REFUND_MARKED_DONE":
      return msg(locale, "refundMarked", { actor, amount, item });
    case "GOAL_REACHED":
      return msg(locale, "goalReached", { item, list });
    case "FRIEND_REQUEST_RECEIVED":
      return msg(locale, "friendRequest", { actor });
    case "FRIEND_REQUEST_ACCEPTED":
      return msg(locale, "friendAccepted", { actor });
    default:
      return msg(locale, "generic", {});
  }
}
