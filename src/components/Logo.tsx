import Link from "next/link";
import Image from "next/image";

export function Logo({
  size = "md",
  href = "/",
  light = false,
  priority = false,
}: {
  size?: "sm" | "md" | "lg";
  href?: string | null;
  light?: boolean;
  /** Mark logo icon as LCP candidate on auth/landing screens */
  priority?: boolean;
}) {
  const sizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl md:text-5xl",
  };
  const icon = { sm: 18, md: 22, lg: 34 }[size];
  const content = (
    <span
      className={`pixel-font ${sizes[size]} ${light ? "text-white" : "text-black"} inline-flex items-center gap-2`}
    >
      <Image
        src="/decor/star-pixel-logo.png"
        alt=""
        width={icon}
        height={icon}
        sizes={`${icon}px`}
        priority={priority}
        className="inline-block"
        draggable={false}
      />
      Wishlist
    </span>
  );
  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}
