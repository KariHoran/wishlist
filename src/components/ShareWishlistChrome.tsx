"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Navbar } from "@/components/Navbar";
import { WishlistView, type ClientItem } from "@/components/WishlistView";
import { PublicListBadge } from "@/components/WinDecor";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

type Props = {
  shareToken: string;
  wishlist: {
    id: string;
    title: string;
    emoji: string | null;
    isPublic: boolean;
    ownerId: string;
    currency: string;
    deadline: string | null;
  };
  items: ClientItem[];
};

/**
 * Session-aware chrome for the public share page.
 * Server HTML stays ISR-cacheable (no cookies()); personalization hydrates via SessionProvider.
 */
export function ShareWishlistChrome({ shareToken, wishlist, items }: Props) {
  const { data: session } = useSession();
  const t = useTranslations("wishlist");
  const currentUserId = session?.user?.id;
  const isOwner = Boolean(currentUserId && currentUserId === wishlist.ownerId);

  return (
    <>
      {currentUserId ? (
        <Navbar
          avatarUrl={session?.user?.image}
          displayName={session?.user?.name}
        />
      ) : (
        <header className="flex items-center justify-between gap-4 px-4 py-3 md:px-8">
          <Link
            href={`/register?redirect=/w/${shareToken}`}
            className="pixel-font text-sm underline underline-offset-4 leading-normal"
          >
            {t("guestAuthCta")}
          </Link>
          <LocaleSwitcher />
        </header>
      )}
      {!isOwner && <PublicListBadge />}
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <WishlistView
          wishlist={wishlist}
          items={items}
          isOwner={isOwner}
          isGuestView={!isOwner}
          currentUserId={currentUserId}
          shareToken={shareToken}
        />
      </main>
    </>
  );
}
