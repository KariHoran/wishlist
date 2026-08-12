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
import {
  amountForSplitIndex,
  canJoinFixedSplit,
  computeSplitPerPerson,
  shouldCloseFixedSplit,
} from "@/lib/money";
import {
  validateContribute,
  validateStartFunding,
  validateUnreserve,
  statusAfterStopFunding,
} from "@/lib/item-status";
import { reserveItemAtomic } from "@/lib/item-reserve";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  emailItemReserved,
  emailItemContributed,
  emailGoalReached,
  getUserEmailIfEnabled,
} from "@/lib/email";

type Ctx = { params: Promise<{ itemId: string }> };

const MESSAGE_MAX = 200;

function sanitizeMessage(raw: unknown): string | null {
  if (raw == null) return null;
  const text = String(raw).trim().slice(0, MESSAGE_MAX);
  return text.length > 0 ? text : null;
}

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
  if (action === "reserve" || action === "contribute") {
    const limit = await enforceRateLimit(
      RATE_LIMITS.reserveOrContribute,
      session.user.id,
    );
    if (!limit.ok) {
      return NextResponse.json(limit.body, {
        status: limit.status,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      });
    }
  }

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
      const startCheck = validateStartFunding(item);
      if (!startCheck.ok) {
        return NextResponse.json(
          { error: startCheck.error },
          { status: startCheck.statusCode },
        );
      }

      const mode =
        String(body.fundingMode ?? "FREE").toUpperCase() === "FIXED_SPLIT"
          ? "FIXED_SPLIT"
          : "FREE";

      let splitParticipants: number | null = null;
      let splitAmountPerPerson: number | null = null;

      if (mode === "FIXED_SPLIT") {
        const n = Number(body.splitParticipants);
        if (!Number.isInteger(n) || n < 2) {
          return NextResponse.json(
            { error: "Укажите число участников (от 2)" },
            { status: 400 },
          );
        }
        splitParticipants = n;
        splitAmountPerPerson = computeSplitPerPerson(Number(item.price), n);
      }

      const updated = await prisma.item.update({
        where: { id: itemId },
        data: {
          status: "FUNDING",
          reservedById: null,
          reservationMessage: null,
          reservationAnonymous: false,
          fundingMode: mode,
          splitParticipants,
          splitAmountPerPerson,
        },
      });
      await publishWishlistUpdate(item.wishlistId);
      return NextResponse.json(updated);
    }

    if (action === "stop_funding" && isOwner) {
      const nextStatus = statusAfterStopFunding(Number(item.amountCollected));
      const updated = await prisma.item.update({
        where: { id: itemId },
        data: {
          status: nextStatus,
          fundingMode: "FREE",
          splitParticipants: null,
          splitAmountPerPerson: null,
        },
      });
      await publishWishlistUpdate(item.wishlistId);
      return NextResponse.json(updated);
    }

    if (action === "reserve" && isGuest) {
      const message = sanitizeMessage(body.message);
      const anonymous = body.anonymous === true;

      const reserveResult = await reserveItemAtomic(prisma, {
        itemId,
        userId: session.user.id,
        message,
        anonymous,
        item: {
          status: item.status,
          fundingMode: item.fundingMode,
          amountCollected: Number(item.amountCollected),
        },
      });
      if (!reserveResult.ok) {
        return NextResponse.json(
          { error: reserveResult.error },
          { status: reserveResult.statusCode },
        );
      }

      const updated = await prisma.item.findUniqueOrThrow({
        where: { id: itemId },
      });

      await createNotification(session.user.id, "ITEM_RESERVED_BY_YOU", {
        itemId: item.id,
        itemName: item.name,
        wishlistId: item.wishlist.id,
        wishlistTitle: item.wishlist.title,
      });

      await createNotification(item.wishlist.ownerId, "ITEM_RESERVED", {
        itemId: item.id,
        itemName: item.name,
        wishlistId: item.wishlist.id,
        wishlistTitle: item.wishlist.title,
        message: message ?? undefined,
        anonymous,
      });

      // Fire-and-forget email to wishlist owner (no await — never blocks reserve)
      void getUserEmailIfEnabled(item.wishlist.ownerId).then((email) => {
        if (email) {
          emailItemReserved({
            to: email,
            itemName: item.name,
            wishlistTitle: item.wishlist.title,
            wishlistId: item.wishlist.id,
          });
        }
      });

      await publishWishlistUpdate(item.wishlistId);
      return NextResponse.json(updated);
    }

    if (action === "unreserve" && isGuest) {
      const unreserveCheck = validateUnreserve(item, session.user.id);
      if (!unreserveCheck.ok) {
        return NextResponse.json(
          { error: unreserveCheck.error },
          { status: unreserveCheck.statusCode },
        );
      }
      const updated = await prisma.item.update({
        where: { id: itemId },
        data: {
          status: "AVAILABLE",
          reservedById: null,
          reservationMessage: null,
          reservationAnonymous: false,
        },
      });
      await publishWishlistUpdate(item.wishlistId);
      return NextResponse.json(updated);
    }

    if (action === "contribute" && isGuest) {
      const contributeCheck = validateContribute(item);
      if (!contributeCheck.ok) {
        return NextResponse.json(
          { error: contributeCheck.error },
          { status: contributeCheck.statusCode },
        );
      }

      const activeContributions = item.contributions.filter((c) => !c.refunded);
      const isFixed = item.fundingMode === "FIXED_SPLIT";
      const splitN = item.splitParticipants;

      if (isFixed && splitN != null) {
        const joinCheck = canJoinFixedSplit({
          activeContributionCount: activeContributions.length,
          splitParticipants: splitN,
          userAlreadyContributed: activeContributions.some(
            (c) => c.userId === session.user.id,
          ),
        });
        if (!joinCheck.ok) {
          return NextResponse.json(
            { error: joinCheck.error },
            { status: joinCheck.statusCode },
          );
        }
      }

      let amount: number;
      if (isFixed && splitN != null) {
        amount = amountForSplitIndex(
          Number(item.price),
          splitN,
          activeContributions.length,
        );
      } else {
        amount = Number(body.amount);
        if (!amount || amount <= 0) {
          return NextResponse.json({ error: "Укажите сумму" }, { status: 400 });
        }
      }

      const price = new Prisma.Decimal(item.price);
      const collected = new Prisma.Decimal(item.amountCollected);
      const next = collected.add(amount);

      if (!isFixed && next.gt(price)) {
        return NextResponse.json(
          { error: "Сумма превышает оставшуюся стоимость" },
          { status: 400 },
        );
      }

      const message = sanitizeMessage(body.message);
      const anonymous = body.anonymous === true;

      const nextCount = activeContributions.length + 1;
      const goalReached =
        isFixed && splitN != null
          ? shouldCloseFixedSplit({
              activeContributionCount: nextCount,
              splitParticipants: splitN,
              amountCollected: Number(next),
              price: Number(price),
            })
          : next.gte(price);

      const [, updated] = await prisma.$transaction([
        prisma.contribution.create({
          data: {
            itemId,
            userId: session.user.id,
            amount,
            message,
            isAnonymous: anonymous,
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

      await createNotification(item.wishlist.ownerId, "ITEM_CONTRIBUTED", {
        itemId: item.id,
        itemName: item.name,
        wishlistId: item.wishlist.id,
        wishlistTitle: item.wishlist.title,
        amount,
        message: message ?? undefined,
        anonymous,
      });

      // Fire-and-forget email to owner about the contribution
      void getUserEmailIfEnabled(item.wishlist.ownerId).then((email) => {
        if (email) {
          emailItemContributed({
            to: email,
            itemName: item.name,
            wishlistTitle: item.wishlist.title,
            wishlistId: item.wishlist.id,
            amount,
          });
        }
      });

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
          // Fire-and-forget email to each participant about goal reached
          void getUserEmailIfEnabled(uid).then((email) => {
            if (email) {
              emailGoalReached({
                to: email,
                itemName: item.name,
                wishlistTitle: item.wishlist.title,
                wishlistId: item.wishlist.id,
              });
            }
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
