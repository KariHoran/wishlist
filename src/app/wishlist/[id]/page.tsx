import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { WishlistView } from "@/components/WishlistView";

type Props = { params: Promise<{ id: string }> };

export default async function WishlistPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();

  const wishlist = await prisma.wishlist.findUnique({
    where: { id },
    include: {
      owner: true,
      items: {
        where: { status: { not: "CANCELLED" } },
        include: {
          contributions: {
            include: { user: { select: { id: true, displayName: true, handle: true } } },
            orderBy: { createdAt: "asc" },
          },
          reservedBy: { select: { id: true, displayName: true, handle: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!wishlist) notFound();

  const isOwner = session?.user?.id === wishlist.ownerId;
  if (!wishlist.isPublic && !isOwner) {
    if (!session) redirect(`/login?callbackUrl=/wishlist/${id}`);
    notFound();
  }

  const viewer = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id } })
    : null;

  const items = isOwner
    ? wishlist.items.map((item) => ({
        ...item,
        price: item.price.toString(),
        amountCollected: item.amountCollected.toString(),
        reservedBy: null,
        reservedById: item.reservedById ? "hidden" : null,
        contributions: [],
        contributorCount: item.contributions.length,
      }))
    : wishlist.items.map((item) => ({
        ...item,
        price: item.price.toString(),
        amountCollected: item.amountCollected.toString(),
        contributions: item.contributions.map((c) => ({
          ...c,
          amount: c.amount.toString(),
        })),
      }));

  return (
    <div className="page-frame grid-bg">
      <Navbar
        avatarUrl={viewer?.avatarUrl ?? null}
        displayName={viewer?.displayName ?? session?.user?.name}
      />
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <WishlistView
          wishlist={{
            id: wishlist.id,
            title: wishlist.title,
            emoji: wishlist.emoji,
            isPublic: wishlist.isPublic,
            ownerId: wishlist.ownerId,
          }}
          items={items}
          isOwner={isOwner}
          isGuestView={!isOwner}
          currentUserId={session?.user?.id}
        />
      </main>
    </div>
  );
}
