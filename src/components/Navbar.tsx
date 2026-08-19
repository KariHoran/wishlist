"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export function Navbar({
  avatarUrl,
  displayName,
}: {
  avatarUrl?: string | null;
  displayName?: string | null;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const links = [
    { href: "/dashboard", label: t("wishlists"), short: t("wishlistsShort") },
    { href: "/friends", label: t("friends"), short: t("friendsShort") },
    { href: "/account", label: t("account"), short: t("accountShort") },
  ];

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
                {l.short}
              </Link>
            ))}
          </nav>
          <LocaleSwitcher />
          <NotificationBell />
          <Link
            href="/account"
            className="hard-border h-10 w-10 overflow-hidden rounded-full! bg-[#ddd]"
            title={displayName ?? t("accountTitle")}
            style={{ borderRadius: "9999px" }}
          >
            <Image
              src={avatarUrl || "/decor/avatar-halftone-cat.png"}
              alt={t("avatarAlt", { name: displayName ?? t("avatarFallback") })}
              width={40}
              height={40}
              className="h-full w-full object-cover"
            />
          </Link>
        </div>
      </div>
      <div className="mx-4 mt-1 border-b-2 border-black md:mx-8" />
    </header>
  );
}
