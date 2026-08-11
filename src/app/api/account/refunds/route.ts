import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRub } from "@/lib/money";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
          wishlist: { select: { id: true, title: true } },
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
      amountFormatted: formatRub(Number(c.amount)),
    });
  }

  return NextResponse.json({
    groups: Array.from(byItem.values()),
    totalPending: contributions.length,
  });
}
