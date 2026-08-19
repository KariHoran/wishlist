import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/money";
import { jsonError } from "@/lib/api-response";
import { getUserLocale } from "@/lib/notifications";
import { parseCurrency } from "@/i18n/config";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("unauthorized", 401);
  }

  const locale = await getUserLocale(session.user.id);

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
          wishlist: { select: { id: true, title: true, currency: true } },
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
        userId: string;
        displayName: string;
        handle: string;
        amount: number;
        amountFormatted: string;
      }[];
    }
  >();

  for (const c of contributions) {
    const key = c.item.id;
    if (!byItem.has(key)) {
      byItem.set(key, {
        itemId: c.item.id,
        itemName: c.item.name,
        wishlistTitle: c.item.wishlist.title,
        rows: [],
      });
    }
    byItem.get(key)!.rows.push({
      id: c.id,
      userId: c.user.id,
      displayName: c.user.displayName,
      handle: c.user.handle,
      amount: Number(c.amount),
      amountFormatted: formatCurrency(
        Number(c.amount),
        parseCurrency(c.item.wishlist.currency),
        locale,
      ),
    });
  }

  return NextResponse.json({
    groups: Array.from(byItem.values()),
    totalPending: contributions.length,
  });
}
