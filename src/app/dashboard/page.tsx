import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { ProgressBar } from "@/components/ProgressBar";
import { wishlistProgress } from "@/lib/money";
import { CreateWishlistButton } from "@/components/CreateWishlistButton";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      wishlists: {
        include: { items: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!user) redirect("/login");

  const wishlists = user.wishlists.map((w) => {
    const p = wishlistProgress(w.items);
    return { ...w, progress: p };
  });

  const totalItems = wishlists.reduce((s, w) => s + w.items.length, 0);
  const collectedItems = wishlists.reduce((s, w) => s + w.progress.collected, 0);
  const collectedPct =
    totalItems === 0 ? 0 : Math.round((collectedItems / totalItems) * 100);

  return (
    <div className="page-frame grid-bg relative isolate">
      {/* Decor behind content (main has z-10) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/decor/paw.svg" alt="" className="page-decor top-24 left-2 hidden w-11 opacity-80 lg:block" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/decor/pixel-star.svg" alt="" className="page-decor top-28 right-6 hidden w-10 opacity-70 lg:block" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/decor/halftone-cat.svg" alt="" className="page-decor top-40 left-1/2 hidden w-36 -translate-x-1/2 opacity-25 xl:block" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/decor/notepad.svg" alt="" className="page-decor bottom-40 left-3 hidden w-11 opacity-70 lg:block" />
      <span className="page-decor bottom-24 left-8 hidden rotate-[-12deg] font-serif text-3xl text-[#c9a0ff] opacity-80 xl:block">
        cat
      </span>
      <span className="page-decor top-[58%] right-10 hidden rotate-12 font-serif text-2xl text-[#1e3a8a] opacity-80 xl:block">
        all day
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/decor/halftone-cat.svg" alt="" className="page-decor bottom-6 left-1/2 hidden w-14 -translate-x-1/2 opacity-40 xl:block" />

      <Navbar avatarUrl={user.avatarUrl} displayName={user.displayName} />

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6 md:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <h1 className="display-font text-2xl md:text-3xl">Мои вишлисты</h1>
          <CreateWishlistButton />
        </div>

        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard icon="📁" title="Всего вишлистов" value={String(wishlists.length)} />
          <StatCard icon="⏳" title="Собрано" value={`${collectedPct}%`} />
          <StatCard icon="📄" title="Всего предметов" value={String(totalItems)} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {wishlists.map((w) => (
            <article key={w.id} className="hard-border relative z-10 flex flex-col bg-white p-4">
              <h2 className="pixel-font text-base leading-relaxed">{w.title}</h2>
              <p className="mono-font mt-1 text-lg text-[#555]">
                {w.deadline
                  ? new Date(w.deadline).toLocaleDateString("sv-SE").replace(/-/g, ".")
                  : "Бессрочно"}
              </p>
              <div className="mt-3">
                <ProgressBar percent={w.progress.percent} height={14} />
              </div>
              <p className="mono-font mt-2 mb-4 text-base">
                {w.progress.percent}% собрано · {w.items.length} предметов
              </p>
              <Link href={`/wishlist/${w.id}`} className="btn-primary mt-auto w-full">
                Открыть
              </Link>
            </article>
          ))}
        </div>

        {wishlists.length === 0 && (
          <p className="mono-font mt-8 text-center text-xl text-[#666]">
            Пока нет вишлистов — создайте первый!
          </p>
        )}
      </main>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
}: {
  icon: string;
  title: string;
  value: string;
}) {
  return (
    <div className="hard-border relative z-10 bg-white/95 p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className="pixel-font text-xs">{title}</span>
      </div>
      <p className="display-font mt-2 text-2xl">{value}</p>
    </div>
  );
}
