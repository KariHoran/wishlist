import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishWishlistUpdate } from "@/lib/realtime";
import { Prisma } from "@prisma/client";
import {
  cancelItemWithRefunds,
  hasPendingRefunds,
} from "@/lib/cancellations";
import { createNotification } from "@/lib/notifications";

type Ctx = { params: Promise<{ itemId: string }> };

async function getOwnedItem(itemId: string, userId: string) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: {
      wishlist: { include: { owner: true } },
      contributions: true,
    },
  });
  if (!item) return null;
  if (item.wishlist.ownerId !== userId) return null;
  return item;
}

export async function GET(_req: Request, ctx: Ctx) {
  const { itemId } = await ctx.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const item = await getOwnedItem(itemId, session.user.id);
  if (!item) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!hasPendingRefunds(item)) {
    return NextResponse.json({ requiresConfirmation: false });
  }

  return NextResponse.json({
    requiresConfirmation: true,
    itemName: item.name,
    contributorCount: item.contributions.length,
    totalAmount: Number(item.amountCollected),
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { itemId } = await ctx.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const item = await getOwnedItem(itemId, session.user.id);
  if (!item) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const confirm = body.confirm === true;

  if (hasPendingRefunds(item)) {
    if (!confirm) {
      return NextResponse.json(
        {
          error: "confirmation_required",
          requiresConfirmation: true,
          itemName: item.name,
          contributorCount: item.contributions.length,
          totalAmount: Number(item.amountCollected),
        },
        { status: 409 },
      );
    }
    await cancelItemWithRefunds({
      ...item,
      wishlist: {
        ...item.wishlist,
        owner: item.wishlist.owner,
      },
    });
    return NextResponse.json({ ok: true, cancelled: true });
  }

  await prisma.item.delete({ where: { id: itemId } });
  await publishWishlistUpdate(item.wishlistId);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { itemId } = await ctx.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const action = String(body.action ?? "");

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: {
      wishlist: { include: { owner: true } },
      contributions: { include: { user: true } },
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = item.wishlist.ownerId === session.user.id;
  const isGuest = !isOwner;

  if (!item.wishlist.isPublic && isGuest) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (item.status === "CANCELLED") {
    return NextResponse.json({ error: "Предмет отменён" }, { status: 410 });
  }

  try {
    if (action === "update" && isOwner) {
      const name = body.name !== undefined ? String(body.name).trim() : undefined;
      const price =
        body.price !== undefined && body.price !== null && body.price !== ""
          ? Number(body.price)
          : undefined;
      const imageUrl =
        body.imageUrl !== undefined ? (body.imageUrl ? String(body.imageUrl) : null) : undefined;
      const productUrl =
        body.productUrl !== undefined
          ? body.productUrl
            ? String(body.productUrl)
            : null
          : undefined;

      if (name !== undefined && !name) {
        return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
      }
      if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
        return NextResponse.json({ error: "Некорректная цена" }, { status: 400 });
      }

      const updated = await prisma.item.update({
        where: { id: itemId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(price !== undefined ? { price } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
          ...(productUrl !== undefined ? { productUrl } : {}),
        },
      });
      await publishWishlistUpdate(item.wishlistId);
      return NextResponse.json(updated);
    }

    if (action === "start_funding" && isOwner) {
      const updated = await prisma.item.update({
        where: { id: itemId },
        data: { status: "FUNDING", reservedById: null },
      });
      await publishWishlistUpdate(item.wishlistId);
      return NextResponse.json(updated);
    }

    if (action === "stop_funding" && isOwner) {
      const nextStatus =
        Number(item.amountCollected) > 0 ? "FUNDING" : "AVAILABLE";
      const updated = await prisma.item.update({
        where: { id: itemId },
        data: { status: nextStatus },
      });
      await publishWishlistUpdate(item.wishlistId);
      return NextResponse.json(updated);
    }

    if (action === "reserve" && isGuest) {
      if (item.status === "RESERVED") {
        return NextResponse.json({ error: "Уже забронировано" }, { status: 409 });
      }
      if (item.status === "FUNDING" && Number(item.amountCollected) > 0) {
        return NextResponse.json(
          { error: "Идёт сбор — нельзя забронировать целиком" },
          { status: 409 },
        );
      }
      const updated = await prisma.item.update({
        where: { id: itemId },
        data: { status: "RESERVED", reservedById: session.user.id },
      });

      await createNotification(session.user.id, "ITEM_RESERVED_BY_YOU", {
        itemId: item.id,
        itemName: item.name,
        wishlistId: item.wishlist.id,
        wishlistTitle: item.wishlist.title,
      });

      await publishWishlistUpdate(item.wishlistId);
      return NextResponse.json(updated);
    }

    if (action === "unreserve" && isGuest) {
      if (item.reservedById !== session.user.id) {
        return NextResponse.json({ error: "Это не ваша бронь" }, { status: 403 });
      }
      const updated = await prisma.item.update({
        where: { id: itemId },
        data: { status: "AVAILABLE", reservedById: null },
      });
      await publishWishlistUpdate(item.wishlistId);
      return NextResponse.json(updated);
    }

    if (action === "contribute" && isGuest) {
      const amount = Number(body.amount);
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: "Укажите сумму" }, { status: 400 });
      }
      if (item.status === "RESERVED") {
        return NextResponse.json({ error: "Предмет забронирован" }, { status: 409 });
      }

      const price = new Prisma.Decimal(item.price);
      const collected = new Prisma.Decimal(item.amountCollected);
      const next = collected.add(amount);
      if (next.gt(price)) {
        return NextResponse.json(
          { error: "Сумма превышает оставшуюся стоимость" },
          { status: 400 },
        );
      }

      const goalReached = next.gte(price);

      const [, updated] = await prisma.$transaction([
        prisma.contribution.create({
          data: {
            itemId,
            userId: session.user.id,
            amount,
          },
        }),
        prisma.item.update({
          where: { id: itemId },
          data: {
            amountCollected: next,
            status: "FUNDING",
            reservedById: null,
          },
        }),
      ]);

      if (goalReached) {
        const notifyIds = new Set([
          ...item.contributions.map((c) => c.userId),
          session.user.id,
          item.wishlist.ownerId,
        ]);
        for (const uid of notifyIds) {
          await createNotification(uid, "GOAL_REACHED", {
            itemId: item.id,
            itemName: item.name,
            wishlistId: item.wishlist.id,
            wishlistTitle: item.wishlist.title,
            amount: Number(item.price),
          });
        }
      }

      await publishWishlistUpdate(item.wishlistId);
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
