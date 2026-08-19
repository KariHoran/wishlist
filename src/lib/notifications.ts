import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publishUserNotification } from "@/lib/realtime";
import { parseLocale, type AppLocale } from "@/i18n/config";
import type { NotificationPayload } from "@/lib/notification-text";

export type { NotificationPayload } from "@/lib/notification-text";
export { formatNotificationText } from "@/lib/notification-text";

export async function createNotification(
  userId: string,
  type: NotificationType,
  payload: NotificationPayload,
) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      payload: payload as object,
    },
  });
  await publishUserNotification(userId);
  return notification;
}

export async function getUserLocale(userId: string): Promise<AppLocale> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { locale: true },
  });
  return parseLocale(user?.locale);
}
