import Link from "next/link";

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
  const content = (
    <span
      className={`pixel-font ${sizes[size]} ${light ? "text-white" : "text-black"} inline-flex items-center gap-2`}
    >
      <span aria-hidden className="inline-block leading-none">
        ✦
      </span>
      Wishlist
    </span>
  );
  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}
