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
            where: { refunded: false },
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
        id: item.id,
        name: item.name,
        price: item.price.toString(),
        imageUrl: item.imageUrl,
        productUrl: item.productUrl,
        status: item.status,
        amountCollected: item.amountCollected.toString(),
        fundingMode: item.fundingMode,
        splitParticipants: item.splitParticipants,
        splitAmountPerPerson: item.splitAmountPerPerson
          ? item.splitAmountPerPerson.toString()
          : null,
        reservationMessage: item.reservationMessage,
        reservationAnonymous: item.reservationAnonymous,
        reservedBy: null,
        reservedById: item.reservedById ? "hidden" : null,
        contributions: [],
        contributorCount: item.contributions.length,
      }))
    : wishlist.items.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price.toString(),
        imageUrl: item.imageUrl,
        productUrl: item.productUrl,
        status: item.status,
        amountCollected: item.amountCollected.toString(),
        fundingMode: item.fundingMode,
        splitParticipants: item.splitParticipants,
        splitAmountPerPerson: item.splitAmountPerPerson
          ? item.splitAmountPerPerson.toString()
          : null,
        reservationMessage: item.reservationMessage,
        reservationAnonymous: item.reservationAnonymous,
        reservedById: item.reservedById,
        reservedBy: item.reservedBy
          ? item.reservationAnonymous
            ? { id: item.reservedBy.id, displayName: "Аноним", handle: "anon" }
            : item.reservedBy
          : null,
        contributions: item.contributions.map((c) => ({
          id: c.id,
          amount: c.amount.toString(),
          message: c.message,
          isAnonymous: c.isAnonymous,
          user: c.isAnonymous
            ? { id: c.user.id, displayName: "Аноним", handle: "anon" }
            : c.user,
        })),
        contributorCount: item.contributions.length,
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
            deadline: wishlist.deadline
              ? wishlist.deadline.toISOString().slice(0, 10)
              : null,
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
