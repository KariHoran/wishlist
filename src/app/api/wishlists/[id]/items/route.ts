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

  // Link-only path: try lightweight parse of Open Graph-ish fields if name empty
  if (!name && productUrl) {
    try {
      const scraped = await scrapeProduct(productUrl);
      const item = await prisma.item.create({
        data: {
          wishlistId,
          name: scraped.name || "Товар по ссылке",
          price: scraped.price ?? 0,
          imageUrl: scraped.imageUrl,
          productUrl,
        },
      });
      await publishWishlistUpdate(wishlistId);
      return NextResponse.json(item);
    } catch {
      return NextResponse.json(
        { error: "Не удалось разобрать ссылку — укажите название и цену" },
        { status: 400 },
      );
    }
  }

  if (!name || Number.isNaN(price) || price < 0) {
    return NextResponse.json({ error: "Укажите название и цену" }, { status: 400 });
  }

  const item = await prisma.item.create({
    data: { wishlistId, name, price, imageUrl, productUrl },
  });
  await publishWishlistUpdate(wishlistId);
  return NextResponse.json(item);
}

async function scrapeProduct(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "WishlistBot/1.0" },
    signal: AbortSignal.timeout(5000),
  });
  const html = await res.text();
  const title =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1] ||
    html.match(/<title>([^<]+)/i)?.[1]?.trim();
  const imageUrl =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] ||
    null;
  const priceMatch =
    html.match(/["']price["']\s*:\s*["']?(\d+[.,]?\d*)/i) ||
    html.match(/(\d[\d\s]{2,})\s*₽/);
  const price = priceMatch
    ? Number(String(priceMatch[1]).replace(/\s/g, "").replace(",", "."))
    : null;
  return { name: title ?? null, imageUrl, price };
}
