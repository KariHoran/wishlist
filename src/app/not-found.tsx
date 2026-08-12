import Link from "next/link";
import { Logo } from "@/components/Logo";
import { DecorImage } from "@/components/DecorImage";
import Image from "next/image";

export default function NotFound() {
  return (
    <div
      className="page-frame relative isolate overflow-hidden text-white"
      style={{
        backgroundImage: "url('/decor/windows-xp-wallpaper.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* desktop icons — decorative, non-interactive */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-8 left-6 z-0 hidden space-y-5 text-center text-xs md:block"
      >
        {[
          { src: "/decor/computer-icon.png", label: "Computer", w: 48, h: 64 },
          { src: "/decor/disk-cd.png", label: "Disk", w: 48, h: 62 },
          { src: "/decor/textfile-icon.png", label: "File", w: 40, h: 40 },
          { src: "/decor/folder-icon.png", label: "Documents", w: 48, h: 44 },
        ].map((d) => (
          <div key={d.label} className="flex w-16 flex-col items-center">
            <Image src={d.src} alt="" width={d.w} height={d.h} className="drop-shadow" quality={70} />
            <div className="pixel-font mt-1 text-[9px] text-white drop-shadow">{d.label}</div>
          </div>
        ))}
      </div>

      <DecorImage
        src="/decor/paw-print-pink.png"
        width={56}
        height={48}
        className="top-8 right-44 hidden w-12 opacity-90 md:block"
      />
      <DecorImage
        src="/decor/windows-error-stack.png"
        width={280}
        height={170}
        className="top-10 right-6 hidden w-56 opacity-95 md:block lg:w-64"
      />
      <DecorImage
        src="/decor/bunny-pixel.png"
        width={64}
        height={70}
        className="top-48 right-10 hidden w-12 opacity-90 md:block"
      />

      <main className="relative z-10 flex min-h-[calc(100dvh-10px)] flex-col items-center justify-center px-4 text-center">
        <Logo size="md" href="/" light />
        <p
          className="display-font mt-10 text-[72px] leading-none text-white md:text-[120px]"
          style={{
            WebkitTextStroke: "4px #000",
            paintOrder: "stroke fill",
          }}
        >
          404
        </p>
        <p className="pixel-font mt-4 text-sm md:text-base">Упс! страница не найдена</p>
        <Link
          href="/"
          className="pixel-font mt-4 inline-flex items-center gap-2 text-sm underline underline-offset-4 leading-normal"
        >
          Вернуться на главную
          <Image
            src="/decor/cursor-hand.png"
            alt=""
            width={28}
            height={44}
            className="inline-block"
            quality={70}
          />
        </Link>
      </main>

      <DecorImage
        src="/decor/hourglass-icon.png"
        width={40}
        height={70}
        className="bottom-28 left-36 hidden w-10 opacity-90 md:block"
      />
      <DecorImage
        src="/decor/wolf-halftone-yawn.png"
        width={140}
        height={164}
        className="bottom-4 left-4 hidden w-28 opacity-90 md:block"
      />
      <DecorImage
        src="/decor/cat-halftone-sitting.png"
        width={140}
        height={210}
        className="right-6 bottom-4 hidden w-28 rotate-6 opacity-90 md:block"
      />
    </div>
  );
}
