import { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publishUserNotification } from "@/lib/realtime";

export type NotificationPayload = {
  itemId?: string;
  itemName?: string;
  wishlistId?: string;
  wishlistTitle?: string;
  amount?: number;
  actorName?: string;
  actorHandle?: string;
  contributionId?: string;
  refunded?: boolean;
  requestId?: string;
  message?: string;
  anonymous?: boolean;
};

export async function createNotification(
  userId: string,
  type: NotificationType,
  payload: NotificationPayload,
) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      payload: payload as Prisma.InputJsonValue,
    },
  });
  await publishUserNotification(userId);
  return notification;
}

export function formatNotificationText(
  type: NotificationType,
  payload: NotificationPayload,
): string {
  const item = payload.itemName ? `«${payload.itemName}»` : "предмет";
  const list = payload.wishlistTitle ? ` (${payload.wishlistTitle})` : "";
  const amount =
    payload.amount != null
      ? `${Number(payload.amount).toLocaleString("ru-RU")} ₽`
      : "";
  const actor = payload.actorName ?? "Кто-то";
  const msg = payload.message?.trim();
  const msgPart = msg
    ? payload.anonymous
      ? ` Аноним: «${msg}»`
      : ` Сообщение: «${msg}»`
    : "";

  switch (type) {
    case "ITEM_RESERVED_BY_YOU":
      return `Вы зарезервировали ${item}${list}`;
    case "ITEM_RESERVED":
      return `Подарок ${item}${list} забронирован.${msgPart}`;
    case "ITEM_CONTRIBUTED":
      return amount
        ? `Новый взнос ${amount} на ${item}${list}.${msgPart}`
        : `Новый взнос на ${item}${list}.${msgPart}`;
    case "ITEM_CANCELLED_REFUND_DUE":
      return `Автор отменил сбор на ${item} — вам полагается возврат ${amount}`;
    case "REFUND_MARKED_DONE":
      return `${actor} отметил возврат ${amount} за ${item}`;
    case "GOAL_REACHED":
      return `Сбор на ${item}${list} закрыт — 100% собрано!`;
    case "FRIEND_REQUEST_RECEIVED":
      return `${actor} хочет добавить вас в друзья`;
    case "FRIEND_REQUEST_ACCEPTED":
      return `${actor} принял(а) вашу заявку в друзья`;
    default:
      return "Новое уведомление";
  }
}
