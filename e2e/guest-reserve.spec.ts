import { test, expect } from "@playwright/test";

test("guest reserves item on public wishlist", async ({ page, browser }) => {
  const stamp = Date.now();
  const ownerEmail = `owner-${stamp}@e2e.test`;
  const guestEmail = `guest-${stamp}@e2e.test`;
  const password = "testpass123";
  const itemName = `Reserve me ${stamp}`;

  // Owner: register, create public wishlist + item
  await page.goto("/register");
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByLabel("Повторите пароль").fill(password);
  await page.getByRole("button", { name: "Регистрация" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  await page.getByRole("button", { name: "+ Создать вишлист" }).click();
  await page.getByPlaceholder("День рождения").fill("Birthday");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page).toHaveURL(/\/wishlist\//);
  const wishlistUrl = page.url();

  await page.getByRole("button", { name: "+ Добавить предметы" }).click();
  await page.getByLabel("Название предмета").fill(itemName);
  await page.getByLabel("Цена").fill("200");
  await page.getByRole("button", { name: "+ Добавить предмет" }).click();
  await expect(page.getByText(itemName)).toBeVisible({ timeout: 15_000 });

  // Guest in separate context
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.goto("/register");
  await guestPage.getByLabel("Email").fill(guestEmail);
  await guestPage.getByLabel("Пароль", { exact: true }).fill(password);
  await guestPage.getByLabel("Повторите пароль").fill(password);
  await guestPage.getByRole("button", { name: "Регистрация" }).click();
  await expect(guestPage).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  await guestPage.goto(wishlistUrl);
  await guestPage.getByText(itemName).click();
  await guestPage.getByRole("button", { name: "Зарезервировать" }).click();
  await guestPage.getByRole("button", { name: "Подтвердить" }).click();

  await expect(guestPage.getByText(/Забронировано|Снять бронь/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(guestPage.getByText("💡 Забронировано")).toBeVisible();

  await guestContext.close();
});
