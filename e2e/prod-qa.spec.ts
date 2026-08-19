import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://wishlist-ashy-three.vercel.app";
const PASSWORD = "password123";
const ts = Date.now();

const OWNER = "demo@wishlist.app";
const A = "katya@wishlist.app";
const B = "anya@wishlist.app";
const C = "egor@wishlist.app";
const D = "ulyana@wishlist.app";
const E = "nastya@wishlist.app";

async function loginUi(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 90_000 });
  if (page.url().includes("/login")) {
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Войти" }).click();
    await page.waitForURL(/\/(dashboard|wishlist|account|friends)/, { timeout: 30_000 });
  }
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

async function login(page: Page, email: string) {
  await loginUi(page, email);
}

async function logout(page: Page) {
  await page.context().clearCookies();
}

async function closeModal(page: Page) {
  const close = page.getByRole("button", { name: "Закрыть" });
  if (await close.isVisible().catch(() => false)) await close.click();
  else await page.keyboard.press("Escape");
}

async function createPublicWishlist(page: Page, title: string) {
  const res = await page.request.post(`${BASE}/api/wishlists`, {
    data: { title, isPublic: true },
  });
  if (!res.ok()) {
    throw new Error(`create wishlist failed: ${res.status()} ${await res.text()}`);
  }
  const data = (await res.json()) as { id: string };
  await page.goto(`/wishlist/${data.id}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  return data.id;
}

async function addItem(page: Page, name: string, price: string) {
  const wishlistId = page.url().match(/\/wishlist\/([^/?]+)/)?.[1];
  if (!wishlistId) throw new Error("not on wishlist page");
  const res = await page.request.post(`${BASE}/api/wishlists/${wishlistId}/items`, {
    data: { name, price: Number(price) },
  });
  if (!res.ok()) {
    throw new Error(`add item failed: ${res.status()} ${await res.text()}`);
  }
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  await expect(page.getByText(name)).toBeVisible({ timeout: 20_000 });
}

async function openItem(page: Page, name: string) {
  await page.locator("article").filter({ hasText: name }).first().click();
}

async function startFixedSplit(page: Page, n: number) {
  await page.getByRole("button", { name: "Начать сбор денег" }).click();
  await page.getByText("Складчина на N человек").click();
  await page.locator("#split-n").fill(String(n));
  await page.getByRole("button", { name: "Запустить" }).click();
}

async function startFreeFunding(page: Page) {
  await page.getByRole("button", { name: "Начать сбор денег" }).click();
  await page.getByRole("button", { name: "Запустить" }).click();
}

async function chipIn(
  page: Page,
  opts?: { message?: string; anonymous?: boolean; amount?: string },
) {
  await page.getByRole("button", { name: "Скинуться" }).first().click();
  if (opts?.amount) await page.locator("#chip-amount").fill(opts.amount);
  if (opts?.message) await page.locator("#item-message").fill(opts.message);
  if (opts?.anonymous) await page.locator("#item-message-anon").check();
  await page
    .locator("form")
    .filter({ has: page.locator("#item-message") })
    .getByRole("button", { name: "Скинуться" })
    .click();
  await page.waitForTimeout(2000);
}

async function reserveItem(page: Page, opts?: { message?: string; anonymous?: boolean }) {
  await page.getByRole("button", { name: "Зарезервировать" }).click();
  if (opts?.message) await page.locator("#item-message").fill(opts.message);
  if (opts?.anonymous) await page.locator("#item-message-anon").check();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await page.waitForTimeout(2000);
}

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

let wlSplit = "";
let wlAnon = "";
let wlRefund = "";
let shareUrl = "";

test("1. Fixed split — 3 contributors, auto-close, block 4th", async ({ page }) => {
  await login(page, OWNER);
  wlSplit = await createPublicWishlist(page, `QA Split ${ts}`);
  await addItem(page, `SplitItem ${ts}`, "300");
  await openItem(page, `SplitItem ${ts}`);
  await startFixedSplit(page, 3);
  await closeModal(page);
  await logout(page);

  for (const acc of [A, B, C]) {
    await login(page, acc);
    await page.goto(`/wishlist/${wlSplit}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await openItem(page, `SplitItem ${ts}`);
    await chipIn(page);
    await closeModal(page);
    await logout(page);
  }

  await login(page, OWNER);
  await page.goto(`/wishlist/${wlSplit}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await openItem(page, `SplitItem ${ts}`);
  await expect(page.getByText(/Скинулись:\s*3 из 3/)).toBeVisible({ timeout: 15_000 });
  await closeModal(page);
  await logout(page);

  await login(page, D);
  await page.goto(`/wishlist/${wlSplit}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await expect(page.getByRole("button", { name: "Удалить вишлист" })).not.toBeVisible();
  await openItem(page, `SplitItem ${ts}`);
  await expect(page.getByText("Складчина уже набрана")).toBeVisible({ timeout: 15_000 });
  await logout(page);
});

test("2. Anonymous messages", async ({ page }) => {
  await login(page, OWNER);
  wlAnon = await createPublicWishlist(page, `QA Anon ${ts}`);
  await addItem(page, `AnonReserve ${ts}`, "200");
  await addItem(page, `AnonContrib ${ts}`, "300");
  await openItem(page, `AnonContrib ${ts}`);
  await startFixedSplit(page, 2);
  await closeModal(page);
  await logout(page);

  await login(page, A);
  await page.goto(`/wishlist/${wlAnon}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await openItem(page, `AnonReserve ${ts}`);
  await reserveItem(page, { message: "anon reserve msg", anonymous: true });
  await closeModal(page);

  await openItem(page, `AnonContrib ${ts}`);
  await chipIn(page, { message: "anon contrib msg", anonymous: true });
  await closeModal(page);
  await logout(page);

  await login(page, B);
  await page.goto(`/wishlist/${wlAnon}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await openItem(page, `AnonContrib ${ts}`);
  await expect(page.getByText("Аноним")).toBeVisible();
  await expect(page.getByText("anon contrib msg")).toBeVisible();
  await expect(page.getByText("Катя")).toHaveCount(0);
  await closeModal(page);

  await openItem(page, `AnonReserve ${ts}`);
  await expect(page.getByText("Аноним")).toBeVisible();
  await expect(page.getByText("anon reserve msg")).toBeVisible();
  await logout(page);
});

test("2b. Non-anonymous shows real name", async ({ page }) => {
  await login(page, OWNER);
  await page.goto(`/wishlist/${wlAnon}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await addItem(page, `NamedItem ${ts}`, "150");
  await openItem(page, `NamedItem ${ts}`);
  await startFreeFunding(page);
  await closeModal(page);
  await logout(page);

  await login(page, C);
  await page.goto(`/wishlist/${wlAnon}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await openItem(page, `NamedItem ${ts}`);
  await chipIn(page, { message: "named visible msg", amount: "50" });
  await closeModal(page);
  await logout(page);

  await login(page, B);
  await page.goto(`/wishlist/${wlAnon}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await openItem(page, `NamedItem ${ts}`);
  await expect(page.getByText("Егор")).toBeVisible();
  await expect(page.getByText("named visible msg")).toBeVisible();
  await logout(page);
});

test("3. Refunds on cancel", async ({ page }) => {
  await login(page, OWNER);
  wlRefund = await createPublicWishlist(page, `QA Refund ${ts}`);
  await addItem(page, `RefundItem ${ts}`, "500");
  await openItem(page, `RefundItem ${ts}`);
  await startFreeFunding(page);
  await closeModal(page);
  await logout(page);

  await login(page, A);
  await page.goto(`/wishlist/${wlRefund}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await openItem(page, `RefundItem ${ts}`);
  await chipIn(page, { message: "partial", amount: "100" });
  await closeModal(page);
  await logout(page);

  await login(page, OWNER);
  await page.goto(`/wishlist/${wlRefund}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.getByRole("button", { name: "Удалить" }).first().click();
  await expect(page.getByText(/вернуть/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect(page.getByText(`RefundItem ${ts}`)).not.toBeVisible({ timeout: 20_000 });

  await page.goto("/account/refunds", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await expect(page.getByText(`RefundItem ${ts}`)).toBeVisible({ timeout: 15_000 });
  await page
    .locator("section")
    .filter({ hasText: `RefundItem ${ts}` })
    .getByRole("button", { name: "Отметить как возвращено" })
    .click();
  await expect(
    page.locator("section").filter({ hasText: `RefundItem ${ts}` }),
  ).toHaveCount(0, { timeout: 15_000 });
  await logout(page);

  await login(page, A);
  await page.goto("/notifications", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await expect(page.getByText(/возврат/i)).toBeVisible({ timeout: 15_000 });
  await logout(page);
});

test("4. Friend requests", async ({ page }) => {
  await login(page, A);
  await page.goto("/friends", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.locator("#friend-handle").fill("nastya");
  await page.getByRole("button", { name: "+ Добавить" }).click();
  const sent = page.getByText(/Заявка отправлена|уже|друж/i);
  await expect(sent).toBeVisible({ timeout: 15_000 });
  await logout(page);

  await login(page, E);
  await page.goto("/friends", { waitUntil: "domcontentloaded", timeout: 90_000 });
  const incoming = page.getByText("Входящие заявки");
  if (await incoming.isVisible().catch(() => false)) {
    await expect(page.getByText("Катя")).toBeVisible();
    await page.getByRole("button", { name: "Принять" }).first().click();
    await page.waitForTimeout(1500);
  }
  await expect(page.getByText("Катя")).toBeVisible();
  await logout(page);

  await login(page, A);
  await page.goto("/friends", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await expect(page.getByText("Настя")).toBeVisible();
  await logout(page);
});

test("5. Delete friend mutual", async ({ page }) => {
  await login(page, A);
  await page.goto("/friends", { waitUntil: "domcontentloaded", timeout: 90_000 });
  const del = page.getByRole("button", { name: /Удалить Настя/i });
  if (await del.isVisible().catch(() => false)) {
    await del.click();
  }
  await expect(page.getByText("Настя")).not.toBeVisible({ timeout: 10_000 });
  await logout(page);

  await login(page, E);
  await page.goto("/friends", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await expect(page.getByText("Катя")).not.toBeVisible();
  await logout(page);
});

test("9. Public share link", async ({ page, browser }) => {
  await login(page, OWNER);
  await createPublicWishlist(page, `QA Share ${ts}`);
  await addItem(page, `ShareItem ${ts}`, "100");

  const html = await page.content();
  const m = html.match(/\/w\/([a-z0-9]+)/i);
  shareUrl = m ? `${BASE}/w/${m[1]}` : "";

  if (!shareUrl) {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Поделиться ссылкой" }).click();
    await expect(page.getByText("✓ Скопировано!")).toBeVisible({ timeout: 10_000 });
    shareUrl = await page.evaluate(async () => navigator.clipboard.readText());
  }
  expect(shareUrl).toMatch(/\/w\//);

  const guestCtx = await browser.newContext();
  const guest = await guestCtx.newPage();
  await guest.goto(shareUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await expect(guest.getByText(`QA Share ${ts}`)).toBeVisible({ timeout: 20_000 });
  await guest.locator("article").filter({ hasText: `ShareItem ${ts}` }).click();
  await guest.getByRole("button", { name: "Зарезервировать" }).click();
  await expect(guest).toHaveURL(/\/(register|login)/, { timeout: 20_000 });
  expect(decodeURIComponent(guest.url())).toMatch(/\/w\//);
  await guestCtx.close();

  const oldUrl = shareUrl;
  await page.getByRole("button", { name: "Обновить ссылку" }).click();
  await page.waitForTimeout(2500);

  const guest2 = await browser.newPage();
  await guest2.goto(oldUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await expect(guest2.getByText(/недоступен|не найден|404|Пусто/i)).toBeVisible({
    timeout: 20_000,
  });
  await guest2.close();
  await logout(page);
});

test("11. Empty states retro styling", async ({ page, request }) => {
  const email = `qa-empty-${ts}@wishlist.app`;
  const res = await request.post(`${BASE}/api/register`, {
    data: { email, password: PASSWORD, passwordConfirm: PASSWORD, displayName: "QA Empty" },
  });
  expect(res.ok() || res.status() === 409).toBeTruthy();

  await login(page, email);
  for (const path of ["/dashboard", "/friends", "/notifications", "/account/refunds"]) {
    await page.goto(path, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(page.locator("main")).toBeVisible();
    const text = await page.locator("main").innerText();
    expect(text.length).toBeGreaterThan(10);
    await expect(page.locator(".hard-border, .display-font, .pixel-font")).not.toHaveCount(0);
  }
  await logout(page);
});

test("12. Global error page retro", async ({ page }) => {
  await page.goto("/dev-error", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await expect(page.getByText(/500|ошибк|пошло не так/i)).toBeVisible({ timeout: 20_000 });
});
