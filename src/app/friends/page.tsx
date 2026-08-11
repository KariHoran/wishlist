import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { ProgressBar } from "@/components/ProgressBar";
import { wishlistProgress } from "@/lib/money";
import { AddFriendForm } from "@/components/AddFriendForm";
import { FriendRequestsPanel } from "@/components/FriendRequestsPanel";

export default async function FriendsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

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
      include: { items: true, owner: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="page-frame grid-bg">
      <Navbar avatarUrl={user.avatarUrl} displayName={user.displayName} />
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <h1 className="display-font mb-6 text-2xl md:text-3xl">Друзья</h1>
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

        <h2 className="pixel-font mb-3 text-sm">Мои друзья</h2>
        <div className="space-y-4">
          {friends.map((f) => {
            const lists = friendWishlists.filter((w) => w.ownerId === f.id);
            return (
              <details key={f.id} className="hard-border bg-white p-4">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={f.avatarUrl || "/decor/avatar-cat.svg"}
                        alt=""
                        className="h-10 w-10 rounded-full border-2 border-black object-cover grayscale"
                      />
                      <div>
                        <p className="pixel-font text-sm">{f.displayName}</p>
                        <p className="mono-font text-base text-[#666]">@{f.handle}</p>
                      </div>
                    </div>
                    <span className="btn-secondary text-xs">Посмотреть вишлисты</span>
                  </div>
                </summary>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {lists.map((w) => {
                    const p = wishlistProgress(w.items);
                    return (
                      <article key={w.id} className="hard-border p-3">
                        <h3 className="pixel-font text-sm">{w.title}</h3>
                        <div className="mt-2">
                          <ProgressBar percent={p.percent} height={12} />
                        </div>
                        <p className="mono-font mt-1 mb-3 text-base">
                          {p.percent}% · {w.items.length} предметов
                        </p>
                        <Link href={`/wishlist/${w.id}`} className="btn-primary w-full text-xs">
                          Открыть
                        </Link>
                      </article>
                    );
                  })}
                  {lists.length === 0 && (
                    <p className="mono-font text-lg text-[#777]">Нет публичных вишлистов</p>
                  )}
                </div>
                <Link
                  href={`/f/${f.handle}`}
                  className="pixel-font mt-3 inline-block text-xs underline underline-offset-4 leading-normal"
                >
                  Публичный профиль →
                </Link>
              </details>
            );
          })}
          {friends.length === 0 && (
            <p className="mono-font text-xl text-[#666]">
              Пока нет друзей — отправьте заявку по нику
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
