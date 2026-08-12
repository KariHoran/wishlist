import Image from "next/image";

type Props = {
  src: string;
  width: number;
  height: number;
  className?: string;
  alt?: string;
  priority?: boolean;
};

/** Decorative sticker/photo — always non-interactive, behind content via .page-decor */
export function DecorImage({
  src,
  width,
  height,
  className = "",
  alt = "",
  priority = false,
}: Props) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      quality={70}
      draggable={false}
      className={`page-decor max-w-none ${className}`}
      sizes={`${width}px`}
    />
  );
}
