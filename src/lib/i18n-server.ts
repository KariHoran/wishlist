import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import {
  LOCALE_COOKIE,
  defaultLocale,
  parseLocale,
  type AppLocale,
} from "@/i18n/config";
import { tSync } from "@/i18n/load-messages";

export { interpolate, tSync } from "@/i18n/load-messages";

export async function getRequestLocale(): Promise<AppLocale> {
  try {
    const store = await cookies();
    return parseLocale(store.get(LOCALE_COOKIE)?.value ?? defaultLocale);
  } catch {
    return defaultLocale;
  }
}

/** Server-side error message from errors.* keys (no next-intl request context). */
export function tErrorSync(
  key: string,
  locale: AppLocale,
  params?: Record<string, string | number>,
): string {
  return tSync("errors", key, locale, params);
}

export async function tError(
  key: string,
  params?: Record<string, string | number>,
): Promise<string> {
  const t = await getTranslations("errors");
  return t(key as Parameters<typeof t>[0], params as Record<string, string>);
}

export async function tNotifications(
  key: string,
  params?: Record<string, string | number>,
): Promise<string> {
  const t = await getTranslations("notifications");
  return t(key as Parameters<typeof t>[0], params as Record<string, string>);
}
