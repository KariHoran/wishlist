import sharp from "sharp";
import fs from "fs";
import path from "path";

const dir = "public/decor";
const MAX = 960;
const resized = [];

for (const f of fs.readdirSync(dir).filter((x) => /\.png$/i.test(x))) {
  const p = path.join(dir, f);
  const before = fs.statSync(p).size;
  const input = fs.readFileSync(p);
  const m = await sharp(input).metadata();
  if (!m.width || !m.height) continue;
  const long = Math.max(m.width, m.height);
  if (long <= MAX) continue;
  const buf = await sharp(input)
    .resize({
      width: m.width >= m.height ? MAX : undefined,
      height: m.height > m.width ? MAX : undefined,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();
  fs.writeFileSync(p, buf);
  const meta2 = await sharp(buf).metadata();
  resized.push({
    f,
    before,
    after: buf.length,
    from: `${m.width}x${m.height}`,
    to: `${meta2.width}x${meta2.height}`,
    savedPct: Math.round((1 - buf.length / before) * 100),
  });
}

console.log(JSON.stringify(resized.sort((a, b) => b.before - a.before), null, 2));
const sizes = fs
  .readdirSync(dir)
  .filter((x) => /\.(png|jpg|jpeg)$/i.test(x))
  .map((f) => ({ f, kb: Math.round(fs.statSync(path.join(dir, f)).size / 1024) }))
  .sort((a, b) => b.kb - a.kb);
console.log("TOP", JSON.stringify(sizes.slice(0, 12)));
