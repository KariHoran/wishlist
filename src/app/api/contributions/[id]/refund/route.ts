import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contribution = await prisma.contribution.findUnique({
    where: { id },
    include: {
      user: true,
      item: {
        include: {
          wishlist: { include: { owner: true } },
        },
      },
    },
  });

  if (!contribution) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (contribution.item.wishlist.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (contribution.item.status !== "CANCELLED") {
    return NextResponse.json({ error: "Предмет не отменён" }, { status: 400 });
  }

  if (contribution.refunded) {
    return NextResponse.json({ error: "Уже отмечено" }, { status: 400 });
  }

  const ownerName = contribution.item.wishlist.owner.displayName;

  await prisma.contribution.update({
    where: { id },
    data: { refunded: true, refundedAt: new Date() },
  });

  const pendingNotifs = await prisma.notification.findMany({
    where: {
      userId: contribution.userId,
      type: "ITEM_CANCELLED_REFUND_DUE",
    },
  });
  for (const n of pendingNotifs) {
    const p = n.payload as Record<string, unknown>;
    if (p.contributionId === contribution.id) {
      await prisma.notification.update({
        where: { id: n.id },
        data: { payload: { ...p, refunded: true } },
      });
    }
  }

  await createNotification(contribution.userId, "REFUND_MARKED_DONE", {
    itemId: contribution.item.id,
    itemName: contribution.item.name,
    wishlistId: contribution.item.wishlist.id,
    wishlistTitle: contribution.item.wishlist.title,
    amount: Number(contribution.amount),
    actorName: ownerName,
    contributionId: contribution.id,
    refunded: true,
  });

  return NextResponse.json({ ok: true });
}
