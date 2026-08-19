import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { wishlistProgress } from "@/lib/money";
import { AddFriendForm } from "@/components/AddFriendForm";
import { FriendRequestsPanel } from "@/components/FriendRequestsPanel";
import { FriendsList } from "@/components/FriendsList";

export default async function FriendsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("friends");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      friendsA: { include: { userB: true } },
      friendsB: { include: { userA: true } },
    },
  });
  if (!user) redirect("/login");

  const friends = [
    ...user.friendsA.map((f) => f.userB),
    ...user.friendsB.map((f) => f.userA),
  ];

  const [incoming, outgoing, friendWishlists] = await Promise.all([
    prisma.friendRequest.findMany({
      where: { toId: user.id, status: "PENDING" },
      include: {
        from: {
          select: { id: true, displayName: true, handle: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendRequest.findMany({
      where: { fromId: user.id, status: "PENDING" },
      include: {
        to: {
          select: { id: true, displayName: true, handle: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.wishlist.findMany({
      where: {
        isPublic: true,
        ownerId: { in: friends.map((f) => f.id) },
      },
      include: {
        items: { where: { status: { not: "CANCELLED" } } },
        owner: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const friendCards = friends.map((f) => {
    const lists = friendWishlists.filter((w) => w.ownerId === f.id);
    return {
      id: f.id,
      displayName: f.displayName,
      handle: f.handle,
      avatarUrl: f.avatarUrl,
      wishlists: lists.map((w) => {
        const p = wishlistProgress(w.items);
        return {
          id: w.id,
          title: w.title,
          percent: p.percent,
          itemCount: w.items.length,
        };
      }),
    };
  });

  return (
    <div className="page-frame grid-bg">
      <Navbar avatarUrl={user.avatarUrl} displayName={user.displayName} />
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <h1 className="display-font mb-6 text-2xl md:text-3xl">{t("title")}</h1>
        <AddFriendForm />

        <div className="mt-8">
          <FriendRequestsPanel
            incoming={incoming.map((r) => ({
              id: r.id,
              from: r.from,
              createdAt: r.createdAt.toISOString(),
            }))}
            outgoing={outgoing.map((r) => ({
              id: r.id,
              to: r.to,
              createdAt: r.createdAt.toISOString(),
            }))}
          />
        </div>

        <h2 className="pixel-font mb-3 text-sm">{t("myFriends")}</h2>
        <FriendsList initialFriends={friendCards} />
      </main>
    </div>
  );
}
