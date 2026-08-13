import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { ProgressBar } from "@/components/ProgressBar";
import { PublicListBadge } from "@/components/WinDecor";
import { wishlistProgress } from "@/lib/money";
import { RetroInlineState } from "@/components/RetroState";

type Props = { params: Promise<{ handle: string }> };

export default async function PublicFriendPage({ params }: Props) {
  const { handle } = await params;
  const session = await auth();
  const profile = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    include: {
      wishlists: {
        where: { isPublic: true },
        include: {
          items: { where: { status: { not: "CANCELLED" } } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!profile) notFound();

  const viewer = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id } })
    : null;

  return (
    <div className="page-frame grid-bg relative">
      {viewer && <Navbar avatarUrl={viewer.avatarUrl} displayName={viewer.displayName} />}
      {!viewer && (
        <header className="px-4 py-3 md:px-8">
          <Link
            href="/login"
            className="pixel-font text-sm underline underline-offset-4 leading-normal"
          >
            Войти
          </Link>
        </header>
      )}
      <PublicListBadge />

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <div className="mb-6 flex items-start gap-4">
          <Image
            src={profile.avatarUrl || "/decor/avatar-halftone-cat.png"}
            alt={`Аватар пользователя ${profile.displayName}`}
            width={56}
            height={56}
            className="h-14 w-14 rounded-full border-2 border-black object-cover"
          />
          <div>
            <h1 className="display-font text-2xl">{profile.displayName}</h1>
            <p className="mono-font text-lg text-[#666]">@{profile.handle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profile.wishlists.map((w) => {
            const p = wishlistProgress(w.items);
            return (
              <article key={w.id} className="hard-border bg-white p-4">
                <h2 className="pixel-font text-base">{w.title}</h2>
                <p className="mono-font mt-1 text-lg text-[#555]">
                  {w.deadline
                    ? new Date(w.deadline).toLocaleDateString("sv-SE").replace(/-/g, ".")
                    : "Бессрочно"}
                </p>
                <div className="mt-3">
                  <ProgressBar percent={p.percent} height={14} />
                </div>
                <p className="mono-font mt-2 mb-4 text-base">
                  {p.percent}% собрано · {w.items.length} предметов
                </p>
                <Link href={`/wishlist/${w.id}`} className="btn-primary w-full">
                  Открыть
                </Link>
              </article>
            );
          })}
        </div>
        {profile.wishlists.length === 0 && (
          <RetroInlineState
            title="Нет публичных вишлистов"
            message="Когда пользователь откроет списки для друзей, они появятся здесь."
          />
        )}
      </main>
    </div>
  );
}
