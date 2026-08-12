import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { WishlistView } from "@/components/WishlistView";
import { RetroStatePage } from "@/components/RetroState";
import { PublicListBadge } from "@/components/WinDecor";
import { wishlistProgress } from "@/lib/money";
import Link from "next/link";

type Props = { params: Promise<{ shareToken: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareToken } = await params;
  const wishlist = await prisma.wishlist.findUnique({
    where: { shareToken },
    include: { items: { where: { status: { not: "CANCELLED" } } } },
  });

  if (!wishlist || !wishlist.isPublic) {
    return { title: "✦ Wishlist", description: "Этот список сейчас недоступен" };
  }

  const { percent, collected } = wishlistProgress(wishlist.items);
  return {
    title: `${wishlist.emoji ?? "💖"} ${wishlist.title} — ✦ Wishlist`,
    description: `Собрано ${percent}% • ${collected}/${wishlist.items.length} предметов`,
  };
}

export default async function SharedWishlistPage({ params }: Props) {
  const { shareToken } = await params;
  const session = await auth();

  const wishlist = await prisma.wishlist.findUnique({
    where: { shareToken },
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

  if (!wishlist) {
    return (
      <RetroStatePage
        title="404"
        variant="empty"
        message="Этот список не найден или ссылка устарела"
        actionHref="/"
        actionLabel="На главную"
      />
    );
  }

  if (!wishlist.isPublic) {
    return (
      <RetroStatePage
        title="🔒"
        variant="empty"
        message="Этот список сейчас недоступен. Владелец закрыл доступ."
        actionHref="/"
        actionLabel="На главную"
      />
    );
  }

  const viewer = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id } })
    : null;

  const isOwner = session?.user?.id === wishlist.ownerId;

  const items = wishlist.items.map((item) => ({
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
      {viewer ? (
        <Navbar avatarUrl={viewer.avatarUrl} displayName={viewer.displayName} />
      ) : (
        <header className="px-4 py-3 md:px-8">
          <Link
            href={`/register?redirect=/w/${shareToken}`}
            className="pixel-font text-sm underline underline-offset-4 leading-normal"
          >
            Зарегистрироваться / Войти
          </Link>
        </header>
      )}
      {!isOwner && <PublicListBadge />}
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
          shareToken={shareToken}
        />
      </main>
    </div>
  );
}
