import fs from "fs";
import { spawnSync } from "child_process";

const BASE = "https://wishlist-ashy-three.vercel.app";
const SHARE = "a987c6af-c40e-4c3d-a4f4-355540709aa2";

function runLh(url: string, out: string, headersFile?: string) {
  const args = [
    "--yes",
    "lighthouse@12.8.2",
    url,
    "--only-categories=performance",
    "--form-factor=mobile",
    "--screenEmulation.mobile",
    "--output=json",
    `--output-path=${out}`,
    "--chrome-flags=--headless --no-sandbox --disable-gpu",
    "--quiet",
  ];
  if (headersFile) args.push(`--extra-headers=${headersFile}`);
  console.log("LH", url);
  const r = spawnSync("npx", args, { stdio: "inherit", shell: true });
  if (r.status !== 0) throw new Error(`lighthouse failed for ${url}`);
}

function summarize(file: string) {
  const r = JSON.parse(fs.readFileSync(file, "utf8"));
  const a = r.audits;
  console.log(
    file.split("/").pop(),
    Math.round(r.categories.performance.score * 100),
    "LCP",
    a["largest-contentful-paint"].displayValue,
    "CLS",
    a["cumulative-layout-shift"].displayValue,
    "TBT",
    a["total-blocking-time"].displayValue,
    "SI",
    a["speed-index"].displayValue,
  );
}

async function main() {
  const html = await (await fetch(`${BASE}/w/${SHARE}`)).text();
  const pri = (html.match(/fetchpriority="high"/g) || []).length;
  console.log("fetchpriority=high count on wishlist HTML:", pri);

  runLh(`${BASE}/w/${SHARE}`, "lighthouse-reports/wishlist-final");
  runLh(`${BASE}/login`, "lighthouse-reports/login-final");
  runLh(
    `${BASE}/dashboard`,
    "lighthouse-reports/dashboard-final",
    "lighthouse-reports/extra-headers.json",
  );

  for (const f of [
    "lighthouse-reports/login-before.report.json",
    "lighthouse-reports/login-final",
    "lighthouse-reports/wishlist-retry",
    "lighthouse-reports/wishlist-final",
    "lighthouse-reports/dashboard-auth-after",
    "lighthouse-reports/dashboard-final",
  ]) {
    if (fs.existsSync(f)) summarize(f);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
