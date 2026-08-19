import { ImageResponse } from "next/og";
import { getRequestLocale, tSync } from "@/lib/i18n-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "✦ Wishlist";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const locale = await getRequestLocale();
  const welcome = tSync("og", "welcome", locale);
  const tagline = tSync("og", "tagline", locale);

  const silkscreenData = await fetch(
    "https://fonts.gstatic.com/s/silkscreen/v6/m8JXjfVPf62XiF7kO-i9ULQ.ttf",
  ).then((r) => r.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          backgroundImage:
            "linear-gradient(to right,#e5e5e5 1px,transparent 1px),linear-gradient(to bottom,#e5e5e5 1px,transparent 1px)",
          backgroundSize: "24px 24px",
          position: "relative",
        }}
      >
        {/* Logo */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 60,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: "Silkscreen",
            fontSize: 22,
            color: "#000",
            letterSpacing: 3,
          }}
        >
          ✦ WISHLIST
        </div>

        {/* Decorative paw top-right */}
        <div
          style={{
            position: "absolute",
            top: 30,
            right: 60,
            fontSize: 56,
            opacity: 0.15,
          }}
        >
          🐾
        </div>

        {/* Decorative star bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 60,
            fontSize: 48,
            opacity: 0.15,
          }}
        >
          ✦
        </div>

        {/* Main card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#fff",
            border: "3px solid #000",
            padding: "52px 80px",
            maxWidth: 900,
            width: "100%",
            gap: 16,
          }}
        >
          <div
            style={{
              fontFamily: "Silkscreen",
              fontSize: 52,
              color: "#000",
              textAlign: "center",
              lineHeight: 1.2,
              display: "flex",
            }}
          >
            {welcome}
          </div>
          <div
            style={{
              fontFamily: "Silkscreen",
              fontSize: 24,
              color: "#555",
              textAlign: "center",
              display: "flex",
            }}
          >
            {tagline}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Silkscreen", data: silkscreenData, style: "normal" }],
    },
  );
}
