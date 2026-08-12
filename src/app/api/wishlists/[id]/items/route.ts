import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishWishlistUpdate } from "@/lib/realtime";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id: wishlistId } = await ctx.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const wishlist = await prisma.wishlist.findUnique({ where: { id: wishlistId } });
  if (!wishlist || wishlist.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const price = Number(body.price);
  const imageUrl = body.imageUrl ? String(body.imageUrl) : null;
  const productUrl = body.productUrl ? String(body.productUrl) : null;

  if (!name || Number.isNaN(price) || price < 0) {
    return NextResponse.json({ error: "Укажите название и цену" }, { status: 400 });
  }

  const item = await prisma.item.create({
    data: { wishlistId, name, price, imageUrl, productUrl },
  });
  await publishWishlistUpdate(wishlistId);
  return NextResponse.json(item);
}
