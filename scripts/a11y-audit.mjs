import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const outDir = process.env.A11Y_OUT_DIR ?? ".";

const pages = [
  { name: "login", path: "/login" },
  { name: "dashboard", path: "/dashboard" },
  // We'll audit wishlist detail page only when logged in; for guestless audit it may redirect.
  { name: "wishlist", path: "/wishlist/cmsogquvd000huguk973364ln" },
];

function scoreFromViolations(violations) {
  // Not Lighthouse score; gives stable “good/bad” percentage.
  const v = violations.length;
  return Math.max(0, 100 - v * 2);
}

async function ensureDir(dir) {
  const fs = await import("node:fs/promises");
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // ignore
  }
}

await ensureDir(outDir);

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

// Ensure online state for components that block actions when navigator.onLine === false.
await page.addInitScript(() => {
  try {
    Object.defineProperty(navigator, "onLine", { get: () => true });
  } catch {
    // ignore
  }
});

// Try using demo login if the pages redirect.
async function maybeLogin() {
  const url = page.url();
  if (url.includes("/login")) {
    const email = process.env.A11Y_EMAIL ?? "demo@wishlist.app";
    const password = process.env.A11Y_PASSWORD ?? "password123";
    await page.locator('input[name="email"]').first().fill(email);
    await page.locator('input[name="password"]').first().fill(password);
    await page.getByRole("button", { name: "Войти" }).click();
    await page.waitForFunction(
      (u) => !u.includes("/login"),
      { timeout: 20_000 },
    ).catch(() => {});
  }
}

const results = [];
for (const p of pages) {
  await page.goto(`${baseUrl}${p.path}`, { waitUntil: "domcontentloaded" });
  await maybeLogin();

  const res = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  const violations = res.violations ?? [];
  const score = scoreFromViolations(violations);
  results.push({
    page: p.path,
    violations: violations.length,
    score,
  });

  await page.screenshot({
    path: `${outDir}/${p.name}.png`,
    fullPage: true,
  });

  await page.evaluate(() => void 0);
}

await browser.close();

console.log(JSON.stringify(results, null, 2));

