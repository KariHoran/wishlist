import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { RefundsList } from "@/components/RefundsList";
import { formatRub } from "@/lib/money";

export default async function RefundsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

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
          wishlist: { select: { title: true } },
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
    byItem.get(c.item.id)!.rows.push({
      id: c.id,
      displayName: c.user.displayName,
      handle: c.user.handle,
      amountFormatted: formatRub(Number(c.amount)),
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
          ← Аккаунт
        </Link>
        <h1 className="display-font mt-4 mb-2 text-2xl">Возвраты</h1>
        <p className="mono-font text-lg text-[#666]">
          Переводы делаете сами — здесь только журнал, кому и сколько нужно вернуть
        </p>
        <RefundsList groups={Array.from(byItem.values())} />
      </main>
    </div>
  );
}
