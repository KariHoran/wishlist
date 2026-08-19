import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  LOCALE_COOKIE,
  defaultLocale,
  parseLocale,
  type AppLocale,
} from "@/i18n/config";
import { loadMessages } from "@/i18n/load-messages";

async function resolveLocale(): Promise<AppLocale> {
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  if (fromCookie) {
    return parseLocale(fromCookie);
  }

  try {
    const session = await auth();
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { locale: true },
      });
      if (user?.locale) {
        return parseLocale(user.locale);
      }
    }
  } catch {
    // auth/db unavailable during static generation
  }

  return defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
