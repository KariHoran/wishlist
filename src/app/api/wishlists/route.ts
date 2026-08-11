import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Укажите название" }, { status: 400 });
  }
  const deadline = body.deadline ? new Date(String(body.deadline)) : null;
  const wishlist = await prisma.wishlist.create({
    data: {
      title,
      ownerId: session.user.id,
      isPublic: Boolean(body.isPublic),
      deadline: deadline && !Number.isNaN(deadline.getTime()) ? deadline : null,
    },
  });
  return NextResponse.json(wishlist);
}
