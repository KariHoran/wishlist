import type { ItemStatus } from "@prisma/client";

export type ItemAction =
  | "reserve"
  | "unreserve"
  | "start_funding"
  | "stop_funding"
  | "contribute"
  | "cancel";

export type ItemSnapshot = {
  status: ItemStatus;
  fundingMode?: "FREE" | "FIXED_SPLIT";
  amountCollected?: unknown;
  reservedById?: string | null;
};

export type TransitionResult =
  | { ok: true; nextStatus: ItemStatus }
  | { ok: false; error: string; statusCode: number };

const ALLOWED: Record<ItemStatus, ItemStatus[]> = {
  AVAILABLE: ["RESERVED", "FUNDING", "CANCELLED"],
  RESERVED: ["AVAILABLE", "FUNDING", "CANCELLED"],
  FUNDING: ["AVAILABLE", "FUNDING", "CANCELLED"],
  CANCELLED: [],
};

/** Whether a direct status transition is allowed (ignoring action-specific rules). */
export function canTransition(from: ItemStatus, to: ItemStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: ItemStatus,
  to: ItemStatus,
): TransitionResult {
  if (from === to && to !== "FUNDING") {
    return { ok: false, error: "Статус уже установлен", statusCode: 409 };
  }
  if (!canTransition(from, to)) {
    return {
      ok: false,
      error: `Недопустимый переход ${from} → ${to}`,
      statusCode: 409,
    };
  }
  return { ok: true, nextStatus: to };
}

export function validateReserve(item: ItemSnapshot): TransitionResult {
  if (item.status === "CANCELLED") {
    return { ok: false, error: "Предмет отменён", statusCode: 410 };
  }
  if (item.status === "RESERVED") {
    return { ok: false, error: "Уже забронировано", statusCode: 409 };
  }
  if (item.status === "FUNDING") {
    const collected = Number(item.amountCollected ?? 0);
    if (collected > 0) {
      return {
        ok: false,
        error: "Идёт сбор — нельзя забронировать целиком",
        statusCode: 409,
      };
    }
    if (item.fundingMode === "FIXED_SPLIT") {
      return {
        ok: false,
        error: "Идёт складчина — нельзя забронировать целиком",
        statusCode: 409,
      };
    }
  }
  return assertTransition(item.status, "RESERVED");
}

export function validateStartFunding(item: ItemSnapshot): TransitionResult {
  if (item.status === "CANCELLED") {
    return { ok: false, error: "Предмет отменён", statusCode: 410 };
  }
  if (item.status === "RESERVED") {
    return { ok: false, error: "Сначала нужно снять бронь", statusCode: 409 };
  }
  return assertTransition(item.status === "FUNDING" ? "FUNDING" : item.status, "FUNDING");
}

export function validateUnreserve(
  item: ItemSnapshot,
  userId: string,
): TransitionResult {
  if (item.reservedById !== userId) {
    return { ok: false, error: "Это не ваша бронь", statusCode: 403 };
  }
  return assertTransition("RESERVED", "AVAILABLE");
}

export function validateContribute(item: ItemSnapshot): TransitionResult {
  if (item.status === "CANCELLED") {
    return { ok: false, error: "Предмет отменён", statusCode: 410 };
  }
  if (item.status === "RESERVED") {
    return { ok: false, error: "Предмет забронирован", statusCode: 409 };
  }
  return { ok: true, nextStatus: "FUNDING" };
}

export function statusAfterStopFunding(
  amountCollected: number,
): ItemStatus {
  return amountCollected > 0 ? "FUNDING" : "AVAILABLE";
}
