import { expect, test } from "@playwright/test";

const clientName = "DOSCAR";
const supplierName = "GRASS Shop Kazakhstan";
const exactSupplierResponse =
  "Подтверждаем: клиент ранее не обслуживался, закрепляется за TAMYZ. Комиссия 12%, срок 18 месяцев, выплата за 5 рабочих дней.";

test("клиент → регистрация → запрос → подтверждение → знакомство → журнал", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/clients?q=${encodeURIComponent(clientName)}`);
  await page.getByRole("link", { name: clientName }).first().click();
  await expect(page).toHaveURL(/\/clients\/\d+/);
  const selectedClientName = (await page.getByRole("heading", { level: 1 }).textContent())!;

  await page.locator('select[name="supplierId"]').selectOption({ label: supplierName });
  await page.getByLabel("Комиссия, % *").fill("12");
  await page.getByLabel("Повторные заказы, мес. *").fill("18");
  await page.getByLabel("Выплата после оплаты, раб. дней *").fill("5");
  await page.getByRole("button", { name: "Создать регистрацию" }).click();
  await expect(page.getByRole("status")).toContainText("Регистрация создана");

  let card = page.getByTestId("registration-card").filter({ hasText: supplierName });
  await expect(card).toContainText("черновик");
  const requestMessage = card.getByTestId("request-message");
  await expect(requestMessage).toContainText(`Перед передачей контакта клиента ${selectedClientName}`);
  await expect(requestMessage).not.toContainText("WhatsApp");
  await expect(requestMessage).not.toContainText("Потребность клиента:");
  await card.getByRole("button", { name: "Копировать запрос" }).click();
  await expect(card.getByRole("button", { name: "Скопировано" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    `Перед передачей контакта клиента ${selectedClientName}`,
  );

  await card.getByRole("button", { name: "Отметить запрос отправленным" }).click();
  await expect(page.getByRole("status")).toContainText("ожидаем письменный ответ");
  card = page.getByTestId("registration-card").filter({ hasText: supplierName });
  await expect(card).toContainText("ожидает подтверждения");

  await card.getByLabel("Ответ поставщика *").selectOption("confirmed");
  await card.getByLabel("Комиссия из ответа, %").fill("12");
  await card.getByLabel("Срок из ответа, мес.").fill("18");
  await card.getByLabel("Комментарий / точный текст ответа *").fill(exactSupplierResponse);
  await card.getByRole("button", { name: "Зафиксировать ответ" }).click();
  await expect(page.getByRole("status")).toContainText("Ответ и условия поставщика зафиксированы");

  card = page.getByTestId("registration-card").filter({ hasText: supplierName });
  await expect(card).toContainText("подтверждён");
  await expect(card).toContainText(exactSupplierResponse);
  await expect(card.getByTestId("introduction-message")).toContainText("Коллеги, знакомлю стороны");
  await card.getByRole("button", { name: "Копировать знакомство" }).click();
  await expect(card.getByRole("button", { name: "Скопировано" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Поставщик письменно подтвердил");

  await card.getByRole("button", { name: "Отметить стороны познакомленными" }).click();
  await expect(page.getByRole("status")).toContainText("Знакомство сторон отмечено в журнале");
  card = page.getByTestId("registration-card").filter({ hasText: supplierName });
  await expect(card).toContainText("стороны познакомлены");

  await page.goto(`/activities?q=${encodeURIComponent(clientName)}&type=client`);
  await expect(page.getByText("Создана регистрация клиента")).toBeVisible();
  await expect(page.getByText("Запрошено закрепление клиента")).toBeVisible();
  await expect(page.getByText("Зафиксирован ответ по регистрации")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Стороны познакомлены", exact: true })).toBeVisible();
  await expect(page.getByText(exactSupplierResponse)).toBeVisible();
});
