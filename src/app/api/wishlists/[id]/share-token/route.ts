import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createId } from "@paralleldrive/cuid2";
import { jsonError } from "@/lib/api-response";

type Props = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("unauthorized", 401);
  }
  const { id } = await params;

  const wishlist = await prisma.wishlist.findUnique({ where: { id } });
  if (!wishlist || wishlist.ownerId !== session.user.id) {
    return jsonError("forbidden", 403);
  }

  const oldToken = wishlist.shareToken;
  const newToken = createId();
  const updated = await prisma.wishlist.update({
    where: { id },
    data: { shareToken: newToken },
    select: { shareToken: true },
  });

  revalidateTag(`shared-wishlist:${oldToken}`, "max");
  revalidateTag(`shared-wishlist:${newToken}`, "max");
  revalidatePath(`/w/${oldToken}`);
  revalidatePath(`/w/${newToken}`);

  return NextResponse.json({ shareToken: updated.shareToken });
}
