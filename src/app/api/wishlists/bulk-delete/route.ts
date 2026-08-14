import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishWishlistUpdate } from "@/lib/realtime";
import {
  cancelWishlistPendingItems,
  pendingRefundSummary,
} from "@/lib/cancellations";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string")
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Укажите вишлисты" }, { status: 400 });
  }

  const wishlists = await prisma.wishlist.findMany({
    where: { id: { in: ids }, ownerId: session.user.id },
    include: {
      items: { include: { contributions: true } },
    },
  });
  if (wishlists.length !== ids.length) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirm = body.confirm === true;
  const summary = pendingRefundSummary(wishlists.flatMap((w) => w.items));

  if (summary.itemCount > 0 && !confirm) {
    return NextResponse.json(
      {
        error: "confirmation_required",
        requiresConfirmation: true,
        wishlistCount: wishlists.length,
        ...summary,
        reason: "bulk_delete_wishlists",
      },
      { status: 409 },
    );
  }

  if (summary.itemCount > 0 && confirm) {
    for (const wishlist of wishlists) {
      await cancelWishlistPendingItems(wishlist.id);
    }
  }

  await prisma.wishlist.deleteMany({ where: { id: { in: ids } } });
  for (const id of ids) {
    await publishWishlistUpdate(id);
  }

  return NextResponse.json({ ok: true, deleted: ids.length });
}
