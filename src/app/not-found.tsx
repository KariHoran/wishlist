import Link from "next/link";
import { Logo } from "@/components/Logo";
import { WinErrorStack } from "@/components/WinDecor";

export default function NotFound() {
  return (
    <div
      className="page-frame relative overflow-hidden text-white"
      style={{
        backgroundImage:
          "url('/decor/bliss.svg'), linear-gradient(180deg, #5b9bd5 0%, #5b9bd5 42%, #7ec850 42%, #3d8b37 100%)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* desktop icons */}
      <div className="absolute top-8 left-6 z-10 space-y-5 text-center text-xs">
        {[
          { icon: "🖥️", label: "Computer" },
          { icon: "💿", label: "Disk" },
          { icon: "📁", label: "File" },
          { icon: "📂", label: "Documents" },
        ].map((d) => (
          <div key={d.label} className="w-16">
            <div className="text-3xl drop-shadow">{d.icon}</div>
            <div className="pixel-font mt-1 text-[9px] text-white drop-shadow">{d.label}</div>
          </div>
        ))}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/decor/paw.svg" alt="" className="pointer-events-none absolute top-8 right-40 z-0 hidden w-12 md:block" />
      <WinErrorStack className="pointer-events-none absolute top-10 right-8 z-0 hidden md:block" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/decor/pixel-bunny.svg" alt="" className="pointer-events-none absolute top-44 right-10 z-0 hidden w-12 brightness-0 invert md:block" />

      <main className="relative z-20 flex min-h-[calc(100dvh-10px)] flex-col items-center justify-center px-4 text-center">
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
          <span aria-hidden className="text-lg">
            👆
          </span>
        </Link>
      </main>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/halftone-cat.svg"
        alt=""
        className="pointer-events-none absolute bottom-6 left-6 z-10 hidden w-28 brightness-0 invert md:block"
      />
      <span className="absolute bottom-24 left-36 z-10 hidden text-4xl md:block">⏳</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/halftone-cat.svg"
        alt=""
        className="pointer-events-none absolute right-8 bottom-6 z-10 hidden w-32 rotate-12 opacity-90 brightness-0 invert md:block"
      />
    </div>
  );
}
