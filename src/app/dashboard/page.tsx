import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { ProgressBar } from "@/components/ProgressBar";
import { wishlistProgress } from "@/lib/money";
import { CreateWishlistButton } from "@/components/CreateWishlistButton";
import { DecorImage } from "@/components/DecorImage";
import { RetroInlineState } from "@/components/RetroState";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      wishlists: {
        include: {
          items: { where: { status: { not: "CANCELLED" } } },
        },
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
      {/* Sticker sits in the title band only — bottom must stay above stats cards */}
      <DecorImage
        src="/decor/cat-halftone-face.png"
        width={72}
        height={78}
        className="top-[5.25rem] left-1/2 hidden w-16 -translate-x-1/2 opacity-90 xl:block"
      />
      <DecorImage
        src="/decor/paw-print.png"
        width={64}
        height={84}
        className="top-24 left-2 hidden w-11 opacity-95 lg:block"
      />
      <DecorImage
        src="/decor/star-pixel-pastel.png"
        width={56}
        height={53}
        className="top-28 right-8 hidden w-12 opacity-95 lg:block"
      />
      <DecorImage
        src="/decor/windows-explorer-window.png"
        width={120}
        height={111}
        className="right-0 bottom-6 hidden w-24 translate-x-[35%] opacity-90 xl:block"
      />
      <DecorImage
        src="/decor/cat-text-lettering.png"
        width={120}
        height={80}
        className="bottom-28 left-4 hidden w-24 rotate-[-12deg] opacity-90 xl:block"
      />
      <DecorImage
        src="/decor/all-day-text.png"
        width={100}
        height={100}
        className="top-[62%] right-4 hidden w-16 rotate-12 opacity-90 xl:block"
      />
      <DecorImage
        src="/decor/cat-halftone-sitting.png"
        width={100}
        height={150}
        className="bottom-4 left-1/2 hidden w-14 -translate-x-1/2 opacity-95 xl:block"
      />

      <Navbar avatarUrl={user.avatarUrl} displayName={user.displayName} />

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6 md:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <h1 className="display-font text-2xl md:text-3xl">Мои вишлисты</h1>
          <CreateWishlistButton />
        </div>

        <div className="relative z-10 mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          <div className="mt-8">
            <RetroInlineState
              title="Пока пусто"
              message="У вас пока нет вишлистов — создайте первый."
            />
          </div>
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
    <div className="hard-border relative z-10 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className="pixel-font text-xs">{title}</span>
      </div>
      <p className="display-font mt-2 text-2xl">{value}</p>
    </div>
  );
}
