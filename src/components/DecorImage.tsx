import Image from "next/image";

type Props = {
  src: string;
  width: number;
  height: number;
  className?: string;
  alt?: string;
  priority?: boolean;
  /** Keep dither/halftone dots — skip Next optimizer (WebP softens grain) */
  preserveGrain?: boolean;
};

/** Decorative sticker/photo — always non-interactive, behind content via .page-decor */
export function DecorImage({
  src,
  width,
  height,
  className = "",
  alt = "",
  priority = false,
  preserveGrain = false,
}: Props) {
  const grain =
    preserveGrain ||
    /halftone|wolf-halftone|cat-halftone/i.test(src);

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      quality={grain ? 100 : 70}
      unoptimized={grain}
      draggable={false}
      className={`page-decor max-w-none ${grain ? "halftone-img" : ""} ${className}`}
      sizes={`${width}px`}
    />
  );
}
