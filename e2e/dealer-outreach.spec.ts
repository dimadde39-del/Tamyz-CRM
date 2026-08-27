import { expect, test } from "@playwright/test";

test("дилеры → фильтр → WhatsApp без текста → сохранение статуса", async ({ page }) => {
  await page.goto("/dealers");

  await expect(page.getByRole("heading", { name: "Дилеры SCANDIC" })).toBeVisible();
  await expect(page.getByTestId("dealer-row")).toHaveCount(47);

  const beverageTrade = page.getByTestId("dealer-row").filter({ hasText: "Beverage Trade / FBS" });
  const whatsAppLink = beverageTrade.getByRole("link", { name: "Написать" });
  await expect(whatsAppLink).toHaveAttribute("href", "https://wa.me/77000900022");
  const url = new URL((await whatsAppLink.getAttribute("href"))!);
  expect(url.search).toBe("");

  const modus = page.getByTestId("dealer-row").filter({ hasText: "Modus Foods Kazakhstan" });
  await expect(modus.getByRole("link", { name: "Написать" })).toHaveAttribute(
    "href",
    "https://wa.me/77066909190",
  );
  await expect(modus).toContainText("WhatsApp подтверждён");

  const dudar = page.getByTestId("dealer-row").filter({ hasText: "Dudar" });
  await dudar.getByLabel("Статус Dudar").selectOption("contacted");
  await dudar.getByRole("button", { name: "OK" }).click();
  await page.reload();
  await expect(
    page.getByTestId("dealer-row").filter({ hasText: "Dudar" }).getByLabel("Статус Dudar"),
  ).toHaveValue("contacted");
});
