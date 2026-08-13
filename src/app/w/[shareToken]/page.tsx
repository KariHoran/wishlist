import type { Metadata } from "next";
import { RetroStatePage } from "@/components/RetroState";
import { ShareWishlistChrome } from "@/components/ShareWishlistChrome";
import { getSharedWishlist } from "@/lib/shared-wishlist";
import { wishlistProgress } from "@/lib/money";

type Props = { params: Promise<{ shareToken: string }> };

/** ISR: public share HTML can live at the CDN for ~60s (realtime refreshes after load). */
export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareToken } = await params;
  const wishlist = await getSharedWishlist(shareToken);

  if (!wishlist || !wishlist.isPublic) {
    return { title: "✦ Wishlist", description: "Этот список сейчас недоступен" };
  }

  const { percent, collected } = wishlistProgress(wishlist.items);
  return {
    title: `${wishlist.emoji ?? "💖"} ${wishlist.title} — ✦ Wishlist`,
    description: `Собрано ${percent}% • ${collected}/${wishlist.itemCount} предметов`,
  };
}

export default async function SharedWishlistPage({ params }: Props) {
  const { shareToken } = await params;
  // Single cached DB read (shared with generateMetadata via unstable_cache).
  // No auth()/cookies() here — keeps the route statically cacheable for guests.
  const wishlist = await getSharedWishlist(shareToken);

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

  return (
    <div className="page-frame grid-bg">
      <ShareWishlistChrome
        shareToken={shareToken}
        wishlist={{
          id: wishlist.id,
          title: wishlist.title,
          emoji: wishlist.emoji,
          isPublic: wishlist.isPublic,
          ownerId: wishlist.ownerId,
          deadline: wishlist.deadline,
        }}
        items={wishlist.items}
      />
    </div>
  );
}
