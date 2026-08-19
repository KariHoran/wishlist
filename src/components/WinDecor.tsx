"use client";

import { useTranslations } from "next-intl";

export function WinWelcome({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none select-none border-2 border-black bg-[#c0c0c0] shadow-[2px_2px_0_#000] ${className}`}
      style={{ width: 210 }}
    >
      <div className="flex items-center gap-1 bg-[linear-gradient(90deg,#000080,#1084d0)] px-1 py-0.5 text-[10px] text-white">
        <span className="font-sans">Welcome</span>
      </div>
      <div className="flex gap-2 bg-[#c0c0c0] p-2 text-[11px] text-black">
        <div className="mt-1 h-8 w-8 shrink-0 bg-yellow-400 border border-black flex items-center justify-center text-lg">
          🔑
        </div>
        <div className="flex-1 space-y-1">
          <div>User name</div>
          <div className="h-4 border border-[#808080] bg-white" />
          <div>Password</div>
          <div className="h-4 border border-[#808080] bg-white" />
          <div className="mt-2 flex justify-end gap-1">
            <span className="border border-[#fff] border-r-[#808080] border-b-[#808080] bg-[#c0c0c0] px-2 py-0.5">
              OK
            </span>
            <span className="border border-[#fff] border-r-[#808080] border-b-[#808080] bg-[#c0c0c0] px-2 py-0.5">
              Cancel
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WinSetup({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none select-none border-2 border-black bg-[#c0c0c0] shadow-[2px_2px_0_#000] ${className}`}
      style={{ width: 200 }}
    >
      <div className="bg-[linear-gradient(90deg,#000080,#1084d0)] px-1 py-0.5 text-[10px] text-white">
        Setup
      </div>
      <div className="space-y-2 p-2 text-[11px]">
        <div className="flex items-start gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-white">
            ✓
          </span>
          <span>Installation completed.</span>
        </div>
        <div className="flex justify-end gap-1">
          <span className="border border-[#fff] border-r-[#808080] border-b-[#808080] bg-[#c0c0c0] px-2 py-0.5">
            OK
          </span>
          <span className="border border-[#fff] border-r-[#808080] border-b-[#808080] bg-[#c0c0c0] px-2 py-0.5">
            Continue
          </span>
        </div>
      </div>
    </div>
  );
}

export function WinLoading({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none select-none border-2 border-black bg-white shadow-[3px_3px_0_#000] ${className}`}
      style={{ width: 160 }}
    >
      <div className="flex items-center gap-1 border-b-2 border-black bg-[#ff6b6b] px-2 py-1">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff3b30]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffcc00]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#34c759]" />
        <span className="ml-2 font-sans text-[10px]">Loading...</span>
      </div>
      <div className="space-y-2 bg-[#ffb347] p-3">
        <div className="h-3 border border-black bg-white">
          <div className="h-full w-2/3 bg-[#808080]" />
        </div>
        <div className="mx-auto h-5 w-10 border border-black bg-[#ddd]" />
      </div>
    </div>
  );
}

export function WinExplorer({ className = "" }: { className?: string }) {
  const icons = [
    "📁",
    "📄",
    "🖼️",
    "📁",
    "📄",
    "🖼️",
    "📁",
    "📄",
    "🖼️",
  ];
  return (
    <div
      className={`pointer-events-none select-none border-2 border-black bg-[#c0c0c0] shadow-[3px_3px_0_#000] ${className}`}
      style={{ width: 220 }}
    >
      <div className="flex items-center justify-between bg-[linear-gradient(90deg,#000080,#1084d0)] px-1 py-0.5 text-[9px] text-white">
        <span className="truncate">...\Documents\FolderName\</span>
        <span className="flex gap-0.5">
          <span className="bg-[#c0c0c0] px-1 text-black">_</span>
          <span className="bg-[#c0c0c0] px-1 text-black">□</span>
          <span className="bg-[#c0c0c0] px-1 text-black">×</span>
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 bg-[#e8e8e8] p-2 text-center text-lg">
        {icons.map((ic, i) => (
          <div key={i} className="leading-none">
            <div>{ic}</div>
            <div className="font-sans text-[8px] text-black">
              {i % 3 === 0 ? "Folder" : i % 3 === 1 ? "Text.txt" : "Image.jpg"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WinErrorStack({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none relative select-none ${className}`}>
      <div className="absolute top-3 left-3 h-24 w-44 border-2 border-black bg-[#c0c0c0]" />
      <div className="absolute top-1.5 left-1.5 h-24 w-44 border-2 border-black bg-[#c0c0c0]" />
      <div className="relative h-28 w-48 border-2 border-black bg-[#c0c0c0] shadow-[2px_2px_0_#000]">
        <div className="bg-[linear-gradient(90deg,#000080,#1084d0)] px-1 py-0.5 text-[10px] text-white">
          Error
        </div>
        <div className="flex items-center gap-2 p-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-lg font-bold text-white">
            !
          </span>
          <span className="font-sans text-[11px]">A fatal exception has occurred.</span>
        </div>
        <div className="flex justify-center pb-2">
          <span className="border border-[#fff] border-r-[#808080] border-b-[#808080] bg-[#c0c0c0] px-4 py-0.5 text-[11px]">
            OK
          </span>
        </div>
      </div>
    </div>
  );
}

export function PublicListBadge({ variant = "banner" }: { variant?: "banner" | "modal" }) {
  const t = useTranslations("wishlist");
  return (
    <div
      className={`public-badge public-badge--${variant}`}
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center bg-black text-[10px] text-white">
        !
      </span>
      <span>{t("publicBadge")}</span>
    </div>
  );
}
