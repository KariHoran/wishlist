import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { wishlistProgress } from "@/lib/money";

export const runtime = "nodejs"; // needs Prisma
export const revalidate = 300; // 5 minutes
export const alt = "✦ Wishlist";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function fetchFont(): Promise<ArrayBuffer> {
  const res = await fetch(
    "https://fonts.gstatic.com/s/silkscreen/v6/m8JXjfVPf62XiF7kO-i9ULQ.ttf",
  );
  return res.arrayBuffer();
}

export default async function Image({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;

  const wishlist = await prisma.wishlist.findUnique({
    where: { shareToken },
    include: {
      items: { where: { status: { not: "CANCELLED" } } },
    },
  });

  const fontData = await fetchFont();

  // Neutral fallback for private or missing wishlists
  if (!wishlist || !wishlist.isPublic) {
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
            background: "#fff",
            backgroundImage:
              "linear-gradient(to right,#e5e5e5 1px,transparent 1px),linear-gradient(to bottom,#e5e5e5 1px,transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          <div
            style={{
              fontFamily: "Silkscreen",
              fontSize: 32,
              color: "#888",
              display: "flex",
            }}
          >
            ✦ Этот список недоступен
          </div>
        </div>
      ),
      {
        ...size,
        fonts: [{ name: "Silkscreen", data: fontData, style: "normal" }],
      },
    );
  }

  const { percent, collected } = wishlistProgress(wishlist.items);
  const total = wishlist.items.length;
  const deadlineStr = wishlist.deadline
    ? new Date(wishlist.deadline).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const BAR_WIDTH = 800;
  const fillWidth = Math.round((BAR_WIDTH * percent) / 100);

  // Stripe pattern via repeated segments for the progress bar
  const STRIPE_W = 14;
  const stripeCount = Math.ceil(fillWidth / (STRIPE_W * 2));

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
          padding: "0 60px",
        }}
      >
        {/* Logo */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 60,
            fontFamily: "Silkscreen",
            fontSize: 20,
            color: "#000",
            letterSpacing: 3,
            display: "flex",
          }}
        >
          ✦ WISHLIST
        </div>

        {/* Paw top-right */}
        <div
          style={{
            position: "absolute",
            top: 28,
            right: 56,
            fontSize: 52,
            opacity: 0.12,
            display: "flex",
          }}
        >
          🐾
        </div>

        {/* Star bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            left: 56,
            fontSize: 44,
            opacity: 0.12,
            display: "flex",
          }}
        >
          ✦
        </div>

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 28,
            width: "100%",
            maxWidth: 900,
          }}
        >
          {/* Wishlist title */}
          <div
            style={{
              fontFamily: "Silkscreen",
              fontSize: total === 0 ? 56 : 48,
              color: "#000",
              textAlign: "center",
              lineHeight: 1.25,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              wordBreak: "break-word",
            }}
          >
            {wishlist.emoji ?? "💖"} {wishlist.title}
          </div>

          {/* Progress bar */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              width: BAR_WIDTH,
              gap: 10,
            }}
          >
            {/* Track */}
            <div
              style={{
                width: BAR_WIDTH,
                height: 28,
                border: "2px solid #000",
                background: "#f5f5f5",
                position: "relative",
                overflow: "hidden",
                display: "flex",
              }}
            >
              {/* Fill with diagonal stripes */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: fillWidth,
                  height: 28,
                  background: "#22c55e",
                  display: "flex",
                  overflow: "hidden",
                }}
              >
                {Array.from({ length: stripeCount }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: i * STRIPE_W * 2,
                      top: -4,
                      width: STRIPE_W,
                      height: 36,
                      background: "rgba(0,0,0,0.12)",
                      transform: "skewX(-20deg)",
                      display: "flex",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Stats row */}
            <div
              style={{
                display: "flex",
                gap: 32,
                fontFamily: "Silkscreen",
                fontSize: 18,
                color: "#333",
              }}
            >
              <span style={{ display: "flex" }}>{percent}% собрано</span>
              <span style={{ display: "flex" }}>
                {collected}/{total} предметов
              </span>
              {deadlineStr && (
                <span style={{ display: "flex", color: "#888" }}>
                  до {deadlineStr}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Silkscreen", data: fontData, style: "normal" }],
    },
  );
}
