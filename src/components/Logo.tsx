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
  const icon = { sm: 18, md: 22, lg: 34 }[size];
  const content = (
    <span
      className={`pixel-font ${sizes[size]} ${light ? "text-white" : "text-black"} inline-flex items-center gap-2`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/star-pixel-pastel.png"
        alt=""
        width={icon}
        height={icon}
        className="inline-block"
        draggable={false}
      />
      Wishlist
    </span>
  );
  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}
