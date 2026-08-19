import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { isCurrency, defaultCurrency } from "@/i18n/config";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("unauthorized", 401);
  }
  const wishlists = await prisma.wishlist.findMany({
    where: { ownerId: session.user.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(wishlists);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("unauthorized", 401);
  }
  const body = await req.json();
  const title = String(body.title ?? "").trim();
  if (!title) {
    return jsonError("titleRequired", 400);
  }
  const currencyRaw = body.currency ?? defaultCurrency;
  if (!isCurrency(currencyRaw)) {
    return jsonError("invalidCurrency", 400);
  }
  const deadline = body.deadline ? new Date(String(body.deadline)) : null;
  const wishlist = await prisma.wishlist.create({
    data: {
      title,
      ownerId: session.user.id,
      isPublic: Boolean(body.isPublic),
      currency: currencyRaw,
      deadline: deadline && !Number.isNaN(deadline.getTime()) ? deadline : null,
    },
  });
  return NextResponse.json(wishlist);
}
