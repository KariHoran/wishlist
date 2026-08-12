import fs from "fs";
import sharp from "sharp";

async function floydSteinbergRGBA(inputPath, outPath, maxW) {
  const meta = await sharp(inputPath).metadata();
  const w0 = meta.width || 1;
  const h0 = meta.height || 1;
  const scale = Math.min(1, maxW / w0);
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .resize(w, h, { fit: "inside", kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const px = new Float32Array(width * height);
  const alpha = new Uint8Array(width * height);

  for (let i = 0, p = 0; i < data.length; i += channels, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    alpha[p] = data[i + 3];
    px[p] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (alpha[i] < 16) {
        out[i * 4] = 0;
        out[i * 4 + 1] = 0;
        out[i * 4 + 2] = 0;
        out[i * 4 + 3] = 0;
        continue;
      }
      const old = px[i];
      const neu = old < 128 ? 0 : 255;
      const err = old - neu;
      out[i * 4] = neu;
      out[i * 4 + 1] = neu;
      out[i * 4 + 2] = neu;
      out[i * 4 + 3] = alpha[i];

      if (x + 1 < width) px[i + 1] += (err * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) px[i + width - 1] += (err * 3) / 16;
        px[i + width] += (err * 5) / 16;
        if (x + 1 < width) px[i + width + 1] += (err * 1) / 16;
      }
    }
  }

  await sharp(out, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  console.log(
    outPath,
    `${width}x${height}`,
    "bytes",
    fs.statSync(outPath).size,
  );
}

const jobs = [
  ["cat-halftone-face.png", 520],
  ["cat-halftone-lying.png", 640],
  ["cat-halftone-portrait.png", 480],
  ["cat-halftone-sitting.png", 480],
  ["wolf-halftone-yawn.png", 480],
];

for (const [name, maxW] of jobs) {
  const src = `public/decor/${name}`;
  const bak = src.replace(".png", ".src.png");
  if (!fs.existsSync(bak)) fs.copyFileSync(src, bak);
  await floydSteinbergRGBA(bak, src, maxW);
}

// Navbar / account default avatar: circular crop of face, then dither
const avatarSize = 128;
const faceMeta = await sharp("public/decor/cat-halftone-face.src.png").metadata();
const side = Math.min(faceMeta.width, faceMeta.height);
const left = Math.floor(((faceMeta.width || side) - side) / 2);
const top = Math.floor(((faceMeta.height || side) - side) * 0.12);
await sharp("public/decor/cat-halftone-face.src.png")
  .extract({ left, top, width: side, height: side })
  .resize(avatarSize, avatarSize)
  .toFile("public/decor/_avatar_tmp.png");
await floydSteinbergRGBA(
  "public/decor/_avatar_tmp.png",
  "public/decor/avatar-halftone-cat.png",
  avatarSize,
);
fs.unlinkSync("public/decor/_avatar_tmp.png");
console.log("done");
