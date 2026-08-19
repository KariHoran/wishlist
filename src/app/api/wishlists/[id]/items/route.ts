import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishWishlistUpdate } from "@/lib/realtime";
import { jsonError } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id: wishlistId } = await ctx.params;
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("unauthorized", 401);
  }
  const wishlist = await prisma.wishlist.findUnique({ where: { id: wishlistId } });
  if (!wishlist || wishlist.ownerId !== session.user.id) {
    return jsonError("forbidden", 403);
  }

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const price = Number(body.price);
  const imageUrl = body.imageUrl ? String(body.imageUrl) : null;
  const productUrl = body.productUrl ? String(body.productUrl) : null;

  if (!name || Number.isNaN(price) || price < 0) {
    return jsonError("nameAndPrice", 400);
  }

  const item = await prisma.item.create({
    data: { wishlistId, name, price, imageUrl, productUrl },
  });
  await publishWishlistUpdate(wishlistId);
  return Response.json(item);
}
