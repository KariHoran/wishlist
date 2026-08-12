import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createId } from "@paralleldrive/cuid2";

type Props = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const wishlist = await prisma.wishlist.findUnique({ where: { id } });
  if (!wishlist || wishlist.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const newToken = createId();
  const updated = await prisma.wishlist.update({
    where: { id },
    data: { shareToken: newToken },
    select: { shareToken: true },
  });

  return NextResponse.json({ shareToken: updated.shareToken });
}
