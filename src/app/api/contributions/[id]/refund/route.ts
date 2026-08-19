import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { jsonError } from "@/lib/api-response";
import { parseCurrency } from "@/i18n/config";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("unauthorized", 401);
  }

  Sentry.setUser({ id: session.user.id });
  Sentry.setTag("route", "contribution_refund");
  Sentry.setTag("contributionId", id);

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
    return jsonError("notFound", 404);
  }

  Sentry.setTag("itemId", contribution.item.id);
  Sentry.setTag("wishlistId", contribution.item.wishlist.id);

  if (contribution.item.wishlist.ownerId !== session.user.id) {
    return jsonError("forbidden", 403);
  }

  if (contribution.item.status !== "CANCELLED") {
    return jsonError("itemNotCancelled", 400);
  }

  if (contribution.refunded) {
    return jsonError("alreadyMarked", 400);
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
    currency: parseCurrency(contribution.item.wishlist.currency),
    actorName: ownerName,
    contributionId: contribution.id,
    refunded: true,
  });

  return NextResponse.json({ ok: true });
}
