import { test, expect } from "@playwright/test";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}@e2e.test`;
}

test("register → login → create wishlist → add item → logout", async ({
  page,
}) => {
  const email = uniqueEmail("user");
  const password = "testpass123";

  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByLabel("Повторите пароль").fill(password);
  await page.getByRole("button", { name: "Регистрация" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  await page.getByRole("button", { name: "+ Создать вишлист" }).click();
  await page.getByPlaceholder("День рождения").fill("E2E Wishlist");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Создать" }).click();

  await expect(page).toHaveURL(/\/wishlist\//, { timeout: 15_000 });
  await page.getByRole("button", { name: "+ Добавить предметы" }).click();
  await page.getByLabel("Название предмета").fill("E2E Gift");
  await page.getByLabel("Цена").fill("500");
  await page.getByRole("button", { name: "+ Добавить предмет" }).click();

  await expect(page.getByText("E2E Gift")).toBeVisible({ timeout: 15_000 });

  await page.goto("/account");
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/login/);
});
