import Link from "next/link";
import Image from "next/image";

export function Logo({
  size = "md",
  href = "/",
  light = false,
}: {
  size?: "sm" | "md" | "lg";
  href?: string | null;
  light?: boolean;
}) {
  const sizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl md:text-5xl",
  };
  const icon = { sm: 18, md: 24, lg: 36 }[size];
  const content = (
    <span
      className={`pixel-font ${sizes[size]} ${light ? "text-white" : "text-black"} inline-flex items-center gap-2`}
    >
      <Image
        src="/decor/sparkle-pixel-pair.png"
        alt=""
        width={icon}
        height={Math.round(icon * 0.8)}
        className="inline-block"
        quality={70}
      />
      Wishlist
    </span>
  );
  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}
