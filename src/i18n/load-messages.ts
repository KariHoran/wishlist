import type { AbstractIntlMessages } from "next-intl";
import { parseLocale, type AppLocale } from "@/i18n/config";

import ru from "../../messages/ru.json";
import en from "../../messages/en.json";

const cache = new Map<AppLocale, AbstractIntlMessages>();
cache.set("ru", ru as AbstractIntlMessages);
cache.set("en", en as AbstractIntlMessages);

export async function loadMessages(locale: string): Promise<AbstractIntlMessages> {
  const resolved = parseLocale(locale);
  const hit = cache.get(resolved);
  if (hit) return hit;
  try {
    const messages = (await import(`../../messages/${resolved}.json`)).default;
    cache.set(resolved, messages as AbstractIntlMessages);
    return messages as AbstractIntlMessages;
  } catch {
    return ru as AbstractIntlMessages;
  }
}

export function loadMessagesSync(locale: string): AbstractIntlMessages {
  const resolved = parseLocale(locale);
  const hit = cache.get(resolved);
  if (hit) return hit;
  return ru as AbstractIntlMessages;
}

export function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  let text = template;
  for (const [k, v] of Object.entries(params)) {
    text = text.split(`{${k}}`).join(String(v));
  }
  return text;
}

export function tSync(
  namespace: string,
  key: string,
  locale: AppLocale,
  params?: Record<string, string | number>,
): string {
  const messages = loadMessagesSync(locale) as Record<
    string,
    Record<string, string> | undefined
  >;
  return interpolate(messages[namespace]?.[key] ?? key, params);
}
