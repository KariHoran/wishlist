/**
 * Compress public/decor rasters for UI sizes.
 * - Halftone assets stay untouched (served unoptimized; file size > pixel dims).
 * - Others: resize max edge 480 + compress; write only if smaller.
 *
 *   npx tsx scripts/compress-decor.ts
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const DIR = path.join(process.cwd(), "public", "decor");
const MAX_EDGE = 480;
const HALFTONE = /halftone|wolf-halftone/i;

async function processFile(file: string) {
  const full = path.join(DIR, file);
  const before = fs.statSync(full).size;

  if (HALFTONE.test(file)) {
    console.log(`KEEP halftone ${file}: ${before} B`);
    return before;
  }

  const meta = await sharp(full).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) {
    console.log(`skip ${file}`);
    return before;
  }

  const edge = Math.max(w, h);
  let pipeline = sharp(full);
  if (edge > MAX_EDGE) {
    pipeline = pipeline.resize({
      width: w >= h ? MAX_EDGE : undefined,
      height: h > w ? MAX_EDGE : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const ext = path.extname(file).toLowerCase();
  let out: Buffer;
  if (ext === ".jpg" || ext === ".jpeg") {
    out = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  } else {
    const plain = await pipeline
      .clone()
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    const paletted = await pipeline
      .clone()
      .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
      .toBuffer();
    out = paletted.length < plain.length ? paletted : plain;
  }

  if (out.length >= before) {
    console.log(`${file}: keep ${before} B (compressed ${out.length})`);
    return before;
  }

  const tmp = `${full}.tmp`;
  fs.writeFileSync(tmp, out);
  fs.renameSync(tmp, full);
  const afterMeta = await sharp(full).metadata();
  console.log(
    `${file}: ${before}→${out.length} B, ${w}x${h}→${afterMeta.width}x${afterMeta.height}`,
  );
  return out.length;
}

async function makeLogoStar() {
  const src = path.join(DIR, "star-pixel-pastel.png");
  const dest = path.join(DIR, "star-pixel-logo.png");
  const out = await sharp(src)
    .resize(68, 68, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, palette: true, quality: 100 })
    .toBuffer();
  fs.writeFileSync(dest, out);
  console.log(`star-pixel-logo.png: ${out.length} B 68x68`);
  return out.length;
}

async function main() {
  // Ensure clean-ish start for logo sibling
  const files = fs
    .readdirSync(DIR)
    .filter((f) => /\.(png|jpe?g)$/i.test(f) && f !== "star-pixel-logo.png");

  let total = 0;
  for (const f of files) {
    total += await processFile(f);
  }
  total += await makeLogoStar();
  console.log(`TOTAL_AFTER ${total}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
