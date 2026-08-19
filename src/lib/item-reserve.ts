import type { PrismaClient } from "@prisma/client";
import { validateReserve } from "@/lib/item-status";

export type ReserveResult =
  | { ok: true; itemId: string }
  | { ok: false; errorKey: string; statusCode: number; errorParams?: Record<string, string> };

/**
 * Atomically reserve an AVAILABLE item.
 * Uses updateMany with status guard so concurrent requests — only one wins.
 */
export async function reserveItemAtomic(
  db: PrismaClient,
  params: {
    itemId: string;
    userId: string;
    message: string | null;
    anonymous: boolean;
    item: {
      status: string;
      fundingMode: string;
      amountCollected: number | string;
    };
  },
): Promise<ReserveResult> {
  const validation = validateReserve({
    status: params.item.status as "AVAILABLE" | "RESERVED" | "FUNDING" | "CANCELLED",
    fundingMode: params.item.fundingMode as "FREE" | "FIXED_SPLIT",
    amountCollected: params.item.amountCollected,
  });
  if (!validation.ok) {
    return {
      ok: false,
      errorKey: validation.errorKey,
      errorParams: validation.errorParams,
      statusCode: validation.statusCode,
    };
  }

  const updated = await db.item.updateMany({
    where: { id: params.itemId, status: "AVAILABLE" },
    data: {
      status: "RESERVED",
      reservedById: params.userId,
      reservationMessage: params.message,
      reservationAnonymous: params.anonymous,
    },
  });

  if (updated.count === 0) {
    return { ok: false, errorKey: "alreadyReserved", statusCode: 409 };
  }

  return { ok: true, itemId: params.itemId };
}
