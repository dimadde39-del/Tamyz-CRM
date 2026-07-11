import { expect, test, type Locator, type Page } from "@playwright/test";

const basketName = "Кухня с посудомоечной машиной";
const clientName = "JAC DOSCAR SHYMKENT";
const supplierName = "IPANDA Chemistry Store";
const commissionScenarioTitle = "E2E · IPANDA · комиссия 10%";
const dealerScenarioTitle = "E2E · IPANDA · дилерская разница";
const zeroAssumptionFields = [
  "Минимальная сумма заказа, ₸",
  "Стоимость доставки, ₸",
  "Другие прямые расходы TAMYZ, ₸",
  "Повторных заказов в месяц",
  "Срок закрепления / повторов, мес.",
  "Срок выплаты после оплаты, раб. дней",
] as const;

function resultMetric(page: Page, label: string): Locator {
  return page
    .getByTestId("economics-results")
    .getByText(label, { exact: true })
    .locator("..")
    .locator("..");
}

function scenarioIdFromUrl(page: Page): number {
  const scenarioId = Number(new URL(page.url()).searchParams.get("scenario"));
  expect(scenarioId).toBeGreaterThan(0);
  return scenarioId;
}

test("IPANDA: расчёт → snapshot → журнал → копия → сравнение → концентрат", async ({
  page,
}) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(15_000);

  await page.goto("/test-baskets");

  const basketHeading = page.getByRole("heading", { level: 2, name: basketName });
  await expect(basketHeading).toBeVisible();
  await basketHeading
    .locator("..")
    .locator("..")
    .getByRole("link", { name: "Предварительный расчёт" })
    .click();

  await expect(page).toHaveURL(/\/economics\?testBasketId=\d+/);
  await expect(page.getByRole("heading", { level: 1, name: "Экономика" })).toBeVisible();

  const clientSelect = page.getByRole("combobox", { name: "Клиент *", exact: true });
  await clientSelect.selectOption({ label: clientName });
  await expect(clientSelect).toHaveValue(/^\d+$/);
  await expect(
    page
      .getByRole("combobox", { name: "Поставщик *", exact: true })
      .locator("option:checked"),
  ).toHaveText(supplierName);
  for (const fieldName of zeroAssumptionFields) {
    await page.getByRole("textbox", { name: fieldName, exact: true }).fill("0");
  }

  await expect(page.getByText("Предварительно", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByTestId("economics-results").getByText(
      "Условия не подтверждены поставщиком: расчёт предварительный.",
      { exact: true },
    ),
  ).toBeVisible();

  await expect(resultMetric(page, "Дилерская корзина")).toContainText(/41\s*195\s*₸/);
  await expect(resultMetric(page, "Корзина для клиента")).toContainText(/50\s*056\s*₸/);
  await expect(resultMetric(page, "Валовый доход TAMYZ")).toContainText(/8\s*861\s*₸/);
  await expect(resultMetric(page, "Доход до налогов")).toContainText(/8\s*861\s*₸/);
  await expect(resultMetric(page, "Эффективная маржа")).toContainText(/17,7\s*%/);

  await page
    .getByRole("textbox", { name: "Название сценария *", exact: true })
    .fill(commissionScenarioTitle);
  await page
    .getByRole("combobox", { name: "Режим заработка *", exact: true })
    .selectOption("referral_commission");
  await page
    .getByRole("textbox", { name: "Комиссия поставщика, %", exact: true })
    .fill("10");

  // 50 056,00 ₸ × 10% = 5 005,60 ₸ exactly; the UI may omit the trailing zero.
  await expect(resultMetric(page, "Валовый доход TAMYZ")).toContainText(
    /5\s*005,60?\s*₸/,
  );
  await expect(resultMetric(page, "Доход до налогов")).toContainText(
    /5\s*005,60?\s*₸/,
  );

  await page.getByRole("button", { name: "Сохранить сценарий" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Snapshot сценария сохранён и записан в журнал.",
  );
  await expect(page).toHaveURL(/\/economics\?scenario=\d+/);
  const commissionScenarioId = scenarioIdFromUrl(page);

  await page.goto(
    `/activities?q=${encodeURIComponent(commissionScenarioTitle)}&type=client`,
  );
  await expect(
    page.getByRole("cell", { name: "Создан сценарий экономики", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(commissionScenarioTitle, { exact: false })).toBeVisible();

  await page.goto(`/economics?scenario=${commissionScenarioId}`);
  const savedCommissionRow = page
    .getByRole("row")
    .filter({ hasText: commissionScenarioTitle });
  await savedCommissionRow.getByRole("link", { name: "Копия", exact: true }).click();
  await expect(page).toHaveURL(`/economics?copy=${commissionScenarioId}`);
  await expect(
    page.getByRole("textbox", { name: "Название сценария *", exact: true }),
  ).toHaveValue(`Копия — ${commissionScenarioTitle}`);
  await page
    .getByRole("textbox", { name: "Название сценария *", exact: true })
    .fill(dealerScenarioTitle);
  await page
    .getByRole("combobox", { name: "Режим заработка *", exact: true })
    .selectOption("dealer_spread");
  await expect(resultMetric(page, "Доход до налогов")).toContainText(/8\s*861\s*₸/);

  await page.getByRole("button", { name: "Сохранить сценарий" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Snapshot сценария сохранён и записан в журнал.",
  );
  await expect(page).toHaveURL(/\/economics\?scenario=\d+/);
  const dealerScenarioId = scenarioIdFromUrl(page);
  expect(dealerScenarioId).not.toBe(commissionScenarioId);

  await page.getByRole("checkbox", { name: commissionScenarioTitle }).check();
  await page.getByRole("checkbox", { name: dealerScenarioTitle }).check();

  const comparison = page.getByTestId("supplier-comparison");
  await expect(comparison).toBeVisible();
  await expect(comparison.getByRole("columnheader")).toHaveCount(3);
  await expect(comparison).toContainText(commissionScenarioTitle);
  await expect(comparison).toContainText(dealerScenarioTitle);
  const comparisonIncome = comparison
    .getByRole("row")
    .filter({ hasText: "Доход TAMYZ до налогов" });
  await expect(comparisonIncome).toContainText(/5\s*005,60?\s*₸/);
  await expect(comparisonIncome).toContainText(/8\s*861\s*₸/);

  await page
    .getByRole("textbox", { name: "Объём упаковки, л *", exact: true })
    .fill("5");
  await page
    .getByRole("textbox", { name: "Цена упаковки, ₸ *", exact: true })
    .fill("9856");
  await page
    .getByRole("textbox", { name: "Пропорция 1:N", exact: true })
    .fill("100");
  await page
    .getByRole("combobox", { name: "Трактовка пропорции *", exact: true })
    .selectOption("concentrate_plus_water");

  const concentrateResults = page.getByTestId("concentrate-results");
  await expect(concentrateResults).toContainText(
    "Трактовка: 1 часть концентрата + 100 частей воды",
  );
  await expect(
    concentrateResults.getByText("Рабочий объём", { exact: true }).locator(".."),
  ).toContainText("505 л");
  await expect(
    concentrateResults.getByText("Стоимость 1 литра", { exact: true }).locator(".."),
  ).toContainText(/19,52\s*₸/);
});
