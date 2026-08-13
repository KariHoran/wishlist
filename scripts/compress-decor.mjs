import sharp from "sharp";
import fs from "fs";
import path from "path";

const dir = "public/decor";
const MAX = 960;
const report = [];

for (const f of fs.readdirSync(dir).filter((x) => /\.png$/i.test(x))) {
  const p = path.join(dir, f);
  const original = fs.readFileSync(p);
  const before = original.length;
  const m = await sharp(original).metadata();
  let pipeline = sharp(original);
  const long = Math.max(m.width || 0, m.height || 0);
  if (long > MAX) {
    pipeline = pipeline.resize({
      width: (m.width || 0) >= (m.height || 0) ? MAX : undefined,
      height: (m.height || 0) > (m.width || 0) ? MAX : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  const candidates = [
    await pipeline.clone().png({ compressionLevel: 9, effort: 10 }).toBuffer(),
    await pipeline
      .clone()
      .png({ compressionLevel: 9, effort: 10, palette: true, quality: 80 })
      .toBuffer(),
  ];
  const best = candidates.sort((a, b) => a.length - b.length)[0];
  if (best.length < before) {
    fs.writeFileSync(p, best);
    const m2 = await sharp(best).metadata();
    report.push({
      f,
      beforeKb: +(before / 1024).toFixed(1),
      afterKb: +(best.length / 1024).toFixed(1),
      savedPct: Math.round((1 - best.length / before) * 100),
      dims: `${m.width}x${m.height} -> ${m2.width}x${m2.height}`,
    });
  } else {
    report.push({
      f,
      beforeKb: +(before / 1024).toFixed(1),
      afterKb: +(before / 1024).toFixed(1),
      savedPct: 0,
      skipped: true,
    });
  }
}

const changed = report.filter((r) => r.savedPct > 0).sort((a, b) => b.beforeKb - a.beforeKb);
console.log(JSON.stringify(changed, null, 2));
const tb = report.reduce((s, r) => s + r.beforeKb, 0);
const ta = report.reduce((s, r) => s + r.afterKb, 0);
console.log(
  "TOTAL_BEFORE_KB",
  Math.round(tb),
  "TOTAL_AFTER_KB",
  Math.round(ta),
  "SAVED_PCT",
  Math.round((1 - ta / tb) * 100),
);
