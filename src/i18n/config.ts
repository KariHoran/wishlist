export const locales = ["ru", "en"] as const;
export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "ru";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const currencies = ["RUB", "USD", "EUR", "CNY"] as const;
export type WishlistCurrency = (typeof currencies)[number];
export const defaultCurrency: WishlistCurrency = "RUB";

const BCP47: Record<AppLocale, string> = {
  ru: "ru-RU",
  en: "en-US",
};

export function isLocale(value: unknown): value is AppLocale {
  return value === "ru" || value === "en";
}

export function isCurrency(value: unknown): value is WishlistCurrency {
  return value === "RUB" || value === "USD" || value === "EUR" || value === "CNY";
}

export function bcp47(locale: AppLocale): string {
  return BCP47[locale];
}

export function parseLocale(value: unknown): AppLocale {
  return isLocale(value) ? value : defaultLocale;
}

export function parseCurrency(value: unknown): WishlistCurrency {
  return isCurrency(value) ? value : defaultCurrency;
}
