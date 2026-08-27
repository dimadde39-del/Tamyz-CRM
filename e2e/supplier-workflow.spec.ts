import { expect, test } from "@playwright/test";

const supplierName = "GRASS Shop Kazakhstan";
const followUpAction = "Уточнить у менеджера агентскую схему и защиту клиента";

test("поставщик → отправка → ответ → менеджер → follow-up → журнал", async ({ page }) => {
  await page.goto("/pipeline");

  let card = page.getByTestId("pipeline-card").filter({ hasText: supplierName });
  await expect(card).toBeVisible();
  await expect(card.locator('a[href="https://wa.me/77053420811"]')).toBeVisible();
  const whatsAppLink = card.locator('a[href="https://wa.me/77778689009"]');
  const href = await whatsAppLink.getAttribute("href");
  expect(href).not.toBeNull();
  const url = new URL(href as string);
  expect(url.hostname).toBe("wa.me");
  expect(url.pathname).toBe("/77778689009");
  expect(url.search).toBe("");

  await card.getByRole("button", { name: "Отметить отправленным" }).click();
  await expect(page.getByRole("status")).toContainText("Отправка зафиксирована");

  card = page.getByTestId("pipeline-card").filter({ hasText: supplierName });
  await expect(card).toContainText("сообщение отправлено");
  await card.getByLabel("Вставить ответ").fill("Автоматический ответ о заказах");
  await card.getByLabel("Результат").selectOption("автоответ");
  await card.getByRole("button", { name: "Сохранить результат" }).click();
  await expect(page.getByRole("status")).toContainText("Ответ, статус и follow-up сохранены");

  card = page.getByTestId("pipeline-card").filter({ hasText: supplierName });
  await expect(card).toContainText("автоответ");
  await card.getByLabel("Вставить ответ").fill(
    "Автоматический ответ о заказах; передан контакт «Ерлан Шымкент»",
  );
  await card.getByLabel("Результат").selectOption("передали менеджеру");
  await card.getByLabel("Дата follow-up").fill("2099-12-31");
  await card.getByLabel("Следующее действие").fill(followUpAction);
  await card.getByRole("button", { name: "Сохранить результат" }).click();

  await expect(page.getByRole("status")).toContainText("Ответ, статус и follow-up сохранены");
  card = page.getByTestId("pipeline-card").filter({ hasText: supplierName });
  await expect(card).toContainText("передали менеджеру");
  await expect(card).toContainText(followUpAction);
  await expect(card).toContainText("31.12.2099");

  await page.goto(`/activities?q=${encodeURIComponent(supplierName)}&type=supplier`);
  await expect(page.getByRole("cell", { name: supplierName }).first()).toBeVisible();
  await expect(page.getByText("не начато").first()).toBeVisible();
  await expect(page.getByText("сообщение отправлено").first()).toBeVisible();
  await expect(page.getByText("автоответ").first()).toBeVisible();
  await expect(page.getByText("передали менеджеру").first()).toBeVisible();
  await expect(page.getByText(followUpAction)).toBeVisible();
});
