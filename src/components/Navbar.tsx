"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";

const links = [
  { href: "/dashboard", label: "Мои вишлисты" },
  { href: "/friends", label: "Друзья" },
  { href: "/account", label: "Аккаунт" },
];

export function Navbar({
  avatarUrl,
  displayName,
}: {
  avatarUrl?: string | null;
  displayName?: string | null;
}) {
  const pathname = usePathname();

  return (
    <header className="relative z-20">
      <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Logo size="sm" href="/dashboard" />
        <nav className="hidden items-center gap-6 md:flex">
          {links.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`pixel-font text-sm ${active ? "underline underline-offset-4" : "hover:underline"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-3 md:hidden">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="pixel-font text-[10px] leading-tight"
              >
                {l.label.split(" ")[0]}
              </Link>
            ))}
          </nav>
          <NotificationBell />
          <Link
            href="/account"
            className="hard-border h-10 w-10 overflow-hidden rounded-full! bg-[#ddd]"
            title={displayName ?? "Аккаунт"}
            style={{ borderRadius: "9999px" }}
          >
            <Image
              src={avatarUrl || "/decor/avatar-halftone-cat.png"}
              alt={`Аватар пользователя ${displayName ?? "аккаунт"}`}
              width={40}
              height={40}
              className="h-full w-full object-cover"
            />
          </Link>
        </div>
      </div>
      {/* Separate divider block with vertical spacing so wrapped titles don't overlap */}
      <div className="mx-4 mt-1 border-b-2 border-black md:mx-8" />
    </header>
  );
}
