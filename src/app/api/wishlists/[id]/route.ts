import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishWishlistUpdate } from "@/lib/realtime";
import {
  cancelWishlistPendingItems,
  pendingRefundSummary,
} from "@/lib/cancellations";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await auth();
  const wishlist = await prisma.wishlist.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, handle: true, displayName: true, avatarUrl: true } },
      items: {
        where: { status: { not: "CANCELLED" } },
        include: {
          contributions: {
            include: { user: { select: { id: true, displayName: true, handle: true } } },
            orderBy: { createdAt: "asc" },
          },
          reservedBy: { select: { id: true, displayName: true, handle: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!wishlist) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = session?.user?.id === wishlist.ownerId;
  if (!wishlist.isPublic && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (isOwner) {
    const sanitized = {
      ...wishlist,
      items: wishlist.items.map((item) => ({
        ...item,
        reservedBy: null,
        reservedById: item.reservedById ? "hidden" : null,
        contributions: [],
        contributorCount: item.contributions.length,
      })),
    };
    return NextResponse.json({ wishlist: sanitized, viewerRole: "owner" });
  }

  const forGuest = {
    ...wishlist,
    items: wishlist.items.map((item) => ({
      ...item,
      reservedBy: item.reservedBy
        ? item.reservationAnonymous
          ? { id: item.reservedBy.id, displayName: "Аноним", handle: "anon" }
          : item.reservedBy
        : null,
      contributions: item.contributions.map((c) => ({
        ...c,
        user: c.isAnonymous
          ? { id: c.user.id, displayName: "Аноним", handle: "anon" }
          : c.user,
      })),
      contributorCount: item.contributions.length,
    })),
  };

  return NextResponse.json({ wishlist: forGuest, viewerRole: "guest" });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const wishlist = await prisma.wishlist.findUnique({
    where: { id },
    include: {
      items: { include: { contributions: true } },
    },
  });
  if (!wishlist || wishlist.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const confirm = body.confirm === true;
  const makingPrivate =
    body.isPublic === false && wishlist.isPublic;

  if (makingPrivate) {
    const summary = pendingRefundSummary(wishlist.items);
    if (summary.itemCount > 0 && !confirm) {
      return NextResponse.json(
        {
          error: "confirmation_required",
          requiresConfirmation: true,
          ...summary,
          reason: "make_private",
        },
        { status: 409 },
      );
    }
    if (summary.itemCount > 0 && confirm) {
      await cancelWishlistPendingItems(id);
    }
  }

  const updated = await prisma.wishlist.update({
    where: { id },
    data: {
      title: body.title !== undefined ? String(body.title) : undefined,
      isPublic: body.isPublic !== undefined ? Boolean(body.isPublic) : undefined,
      deadline:
        body.deadline === null
          ? null
          : body.deadline
            ? new Date(String(body.deadline))
            : undefined,
      emoji: body.emoji !== undefined ? String(body.emoji) : undefined,
    },
  });
  await publishWishlistUpdate(id);
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const wishlist = await prisma.wishlist.findUnique({
    where: { id },
    include: {
      items: { include: { contributions: true } },
    },
  });
  if (!wishlist || wishlist.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const confirm = body.confirm === true;
  const summary = pendingRefundSummary(wishlist.items);

  if (summary.itemCount > 0 && !confirm) {
    return NextResponse.json(
      {
        error: "confirmation_required",
        requiresConfirmation: true,
        ...summary,
        reason: "delete_wishlist",
      },
      { status: 409 },
    );
  }

  if (summary.itemCount > 0 && confirm) {
    await cancelWishlistPendingItems(id);
  }

  await prisma.wishlist.delete({ where: { id } });
  await publishWishlistUpdate(id);
  return NextResponse.json({ ok: true });
}
