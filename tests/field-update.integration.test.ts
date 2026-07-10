import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = ":memory:";
});

import { applyJuly10FieldUpdate } from "@/db/field-update";
import { activityLog, suppliers, testBasketItems, testBaskets } from "@/db/schema";
import { seedKdsOperationalRecord } from "@/db/services";
import { DEFAULT_SOURCE_WORKBOOK, importSourceWorkbook } from "@/lib/import/workbook";

import { createTempDatabase, type TempDatabase } from "./helpers/temp-database";

describe("10 July field updates", () => {
  let context: TempDatabase;

  beforeEach(async () => {
    context = await createTempDatabase();
    await importSourceWorkbook({ filePath: DEFAULT_SOURCE_WORKBOOK, database: context.db });
    seedKdsOperationalRecord(context.db);
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it("records three supplier conversations and three non-client price scenarios idempotently", async () => {
    expect(applyJuly10FieldUpdate(context.db)).toEqual({
      supplierActivitiesCreated: 3,
      testBasketsCreated: 3,
    });

    const ipanda = context.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.name, "IPANDA Chemistry Store"))
      .get();
    const proffClean = context.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.name, "Proff Clean Kazakhstan"))
      .get();
    const kds = context.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.name, "КДС-Алматы"))
      .get();

    expect(ipanda).toMatchObject({
      status: "обсуждение условий",
      priceReceived: "yes",
      originalResponse: "Интерес подтверждён, направление HoReCa, прайс получен, ждём условия.",
    });
    expect(proffClean).toMatchObject({
      status: "обсуждение условий",
      originalResponse: "Заинтересованы, созвон на следующей неделе.",
    });
    expect(proffClean?.nextActionAt?.toISOString().slice(0, 10)).toBe("2026-07-13");
    expect(kds).toMatchObject({
      status: "передали менеджеру",
      hasShymkentRepresentative: "yes",
      originalResponse:
        "Ерлан — дистрибьютор; бумажная продукция производится в Шымкенте. Условия не выяснены.",
    });

    const baskets = context.db.select().from(testBaskets).all();
    expect(baskets).toHaveLength(3);
    expect(baskets.map((basket) => [basket.name, basket.dealerAmount, basket.rrpAmount, basket.priceDifference])).toEqual([
      ["Кухня с посудомоечной машиной", 41_195, 50_056, 8_861],
      ["Небольшое кафе без машины", 30_195, 36_949, 6_754],
      ["Гостиница/клининг", 39_545, 48_950, 9_405],
    ]);
    expect(baskets.every((basket) => basket.differenceIsProfit === false)).toBe(true);
    expect(baskets.every((basket) => basket.commissionStatus === "unknown")).toBe(true);
    expect(context.db.select().from(testBasketItems).all()).toHaveLength(13);
    expect(context.db.select().from(activityLog).all()).toHaveLength(7);

    expect(applyJuly10FieldUpdate(context.db)).toEqual({
      supplierActivitiesCreated: 0,
      testBasketsCreated: 0,
    });
    expect(context.db.select().from(testBaskets).all()).toHaveLength(3);
    expect(context.db.select().from(testBasketItems).all()).toHaveLength(13);
    expect(context.db.select().from(activityLog).all()).toHaveLength(7);

    await importSourceWorkbook({ filePath: DEFAULT_SOURCE_WORKBOOK, database: context.db });
    expect(
      context.db
        .select()
        .from(suppliers)
        .where(eq(suppliers.name, "IPANDA Chemistry Store"))
        .get(),
    ).toMatchObject({ status: "обсуждение условий", priceReceived: "yes" });
  });
});

