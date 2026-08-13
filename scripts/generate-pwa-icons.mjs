/**
 * Rebuild PWA icons from the pixel logo.
 *   node scripts/generate-pwa-icons.mjs
 */
import sharp from "sharp";

async function makeIcon(size, padRatio, out) {
  const pad = Math.round(size * padRatio);
  const inner = Math.max(1, size - pad * 2);
  const resized = await sharp("public/decor/star-pixel-logo.png")
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: resized, left: pad, top: pad }])
    .png()
    .toFile(out);

  console.log("wrote", out);
}

await makeIcon(192, 0.12, "public/icons/icon-192.png");
await makeIcon(512, 0.12, "public/icons/icon-512.png");
await makeIcon(192, 0.2, "public/icons/icon-maskable-192.png");
await makeIcon(512, 0.2, "public/icons/icon-maskable-512.png");
await makeIcon(180, 0.12, "public/icons/apple-touch-icon.png");
