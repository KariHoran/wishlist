import { redirect } from "next/navigation";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { RefundsList } from "@/components/RefundsList";
import { formatCurrency } from "@/lib/money";
import { parseCurrency, type AppLocale } from "@/i18n/config";

export default async function RefundsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("refunds");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const contributions = await prisma.contribution.findMany({
    where: {
      refunded: false,
      item: {
        status: "CANCELLED",
        wishlist: { ownerId: session.user.id },
      },
    },
    include: {
      user: { select: { id: true, displayName: true, handle: true } },
      item: {
        select: {
          id: true,
          name: true,
          wishlist: { select: { title: true, currency: true } },
        },
      },
    },
    orderBy: [{ item: { name: "asc" } }, { createdAt: "asc" }],
  });

  const byItem = new Map<
    string,
    {
      itemId: string;
      itemName: string;
      wishlistTitle: string;
      rows: {
        id: string;
        displayName: string;
        handle: string;
        amountFormatted: string;
      }[];
    }
  >();

  for (const c of contributions) {
    if (!byItem.has(c.item.id)) {
      byItem.set(c.item.id, {
        itemId: c.item.id,
        itemName: c.item.name,
        wishlistTitle: c.item.wishlist.title,
        rows: [],
      });
    }
    const currency = parseCurrency(c.item.wishlist.currency);
    byItem.get(c.item.id)!.rows.push({
      id: c.id,
      displayName: c.user.displayName,
      handle: c.user.handle,
      amountFormatted: formatCurrency(Number(c.amount), currency, locale),
    });
  }

  return (
    <div className="page-frame grid-bg">
      <Navbar avatarUrl={user.avatarUrl} displayName={user.displayName} />
      <main className="mx-auto max-w-2xl px-4 py-6 md:px-8">
        <Link
          href="/account"
          className="pixel-font text-xs underline underline-offset-4 leading-normal"
        >
          {t("backToAccount")}
        </Link>
        <h1 className="display-font mt-4 mb-2 text-2xl">{t("title")}</h1>
        <p className="mono-font text-lg text-[#666]">{t("intro")}</p>
        <RefundsList groups={Array.from(byItem.values())} />
      </main>
    </div>
  );
}
