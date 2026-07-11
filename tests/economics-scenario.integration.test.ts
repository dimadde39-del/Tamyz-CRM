import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = ":memory:";
});

import {
  ECONOMICS_SNAPSHOT_VERSION,
  getEconomicsScenarioById,
  saveEconomicsScenario,
  type EconomicsSnapshotLine,
} from "@/db/economics-scenario-service";
import {
  activityLog,
  clientRegistrations,
  clients,
  economicsScenarios,
  suppliers,
  testBasketItems,
  testBaskets,
} from "@/db/schema";
import {
  ECONOMICS_ENGINE_VERSION,
  calculateEconomics,
  formatMoneyMinor,
  type EconomicsScenarioInput,
} from "@/lib/economics-engine";

import { createTempDatabase, type TempDatabase } from "./helpers/temp-database";

type SnapshotInput = Omit<EconomicsScenarioInput, "lines"> & {
  lines: EconomicsSnapshotLine[];
};

describe("сохранённые сценарии экономики", () => {
  let context: TempDatabase;

  beforeEach(async () => {
    context = await createTempDatabase();
  });

  afterEach(async () => {
    await context.cleanup();
  });

  function insertSupplierTerms(clientId: number, suffix: string) {
    const supplier = context.db
      .insert(suppliers)
      .values({
        externalKey: `economics-supplier-${suffix}`,
        rank: 1,
        priority: "высокий",
        name: `IPANDA ${suffix}`,
      })
      .returning()
      .get();
    const registration = context.db
      .insert(clientRegistrations)
      .values({
        clientId,
        supplierId: supplier.id,
        status: "подтверждён",
        responseType: "confirmed",
        requestedCommissionPercent: 12.5,
        confirmedCommissionPercent: 10.25,
        requestedRepeatCommissionMonths: 18,
        confirmedRepeatCommissionMonths: 12,
        commissionPaymentBusinessDays: 5,
        supplierResponseText: `Условия ${suffix} подтверждены письменно.`,
        requestSentAt: new Date("2026-07-10T06:00:00.000Z"),
        confirmedAt: new Date("2026-07-10T07:00:00.000Z"),
      })
      .returning()
      .get();
    const basket = context.db
      .insert(testBaskets)
      .values({
        externalKey: `economics-basket-${suffix}`,
        supplierId: supplier.id,
        owner: "Ерасыл",
        name: `Кухня IPANDA ${suffix}`,
        dealerAmount: 41_195,
        rrpAmount: 50_056,
        priceDifference: 8_861,
        differenceIsProfit: true,
      })
      .returning()
      .get();
    const basketItem = context.db
      .insert(testBasketItems)
      .values({
        testBasketId: basket.id,
        sortOrder: 1,
        product: "Кухня с посудомоечной машиной",
        sku: `IPANDA-${suffix}`,
      })
      .returning()
      .get();

    return { supplier, registration, basket, basketItem };
  }

  function insertFixture(suffix = "primary") {
    const client = context.db
      .insert(clients)
      .values({
        twoGisFirmId: `economics-client-${suffix}`,
        rank: 1,
        priority: "высокий",
        name: `ТОО Чистая кухня ${suffix}`,
        twoGisUrl: `https://2gis.kz/firm/economics-client-${suffix}`,
      })
      .returning()
      .get();

    return { client, ...insertSupplierTerms(client.id, suffix) };
  }

  function scenarioInput(
    sourceTestBasketItemId: number,
    overrides: Partial<SnapshotInput> = {},
  ): SnapshotInput {
    return {
      lines: [
        {
          key: "ipanda-kitchen",
          name: "Кухня с посудомоечной машиной",
          quantityMilli: 1_000,
          dealerUnitPriceMinor: 4_119_500,
          clientUnitPriceMinor: 5_005_600,
          sourceTestBasketItemId,
          brand: "IPANDA",
          sku: "IPANDA-KITCHEN",
          packaging: "комплект",
        },
      ],
      earningMode: "referral_commission",
      discountBps: 250,
      commissionBps: 1_025,
      fixedFeeMinor: 0,
      minimumOrderMinor: 4_000_000,
      deliveryMinor: 150_000,
      deliveryPayer: "client",
      otherDirectExpensesMinor: 20_000,
      repeatOrdersPerMonthMilli: 1_500,
      repeatCommissionMonths: 12,
      commissionPaymentBusinessDays: 5,
      termsStatus: "confirmed",
      ...overrides,
    };
  }

  function saveFixtureScenario(
    fixture: ReturnType<typeof insertFixture>,
    input = scenarioInput(fixture.basketItem.id),
    occurredAt = new Date("2026-07-11T06:00:00.000Z"),
  ) {
    return saveEconomicsScenario(
      {
        actor: "Ерасыл",
        clientId: fixture.client.id,
        supplierId: fixture.supplier.id,
        registrationId: fixture.registration.id,
        testBasketId: fixture.basket.id,
        title: "IPANDA: кухня, комиссия 10,25%",
        input,
        occurredAt,
      },
      context.db,
    );
  }

  it("сохраняет точный snapshot, результат и запись журнала", () => {
    const fixture = insertFixture();
    const input = scenarioInput(fixture.basketItem.id);
    const occurredAt = new Date("2026-07-11T06:00:00.000Z");

    const saved = saveFixtureScenario(fixture, input, occurredAt);

    expect(saved.snapshot).toEqual({
      snapshotVersion: ECONOMICS_SNAPSHOT_VERSION,
      engineVersion: ECONOMICS_ENGINE_VERSION,
      title: "IPANDA: кухня, комиссия 10,25%",
      termsStatus: "confirmed",
      client: { id: fixture.client.id, name: fixture.client.name },
      supplier: { id: fixture.supplier.id, name: fixture.supplier.name },
      registration: {
        id: fixture.registration.id,
        status: "подтверждён",
        requestedCommissionBps: 1_250,
        confirmedCommissionBps: 1_025,
        requestedRepeatCommissionMonths: 18,
        confirmedRepeatCommissionMonths: 12,
        commissionPaymentBusinessDays: 5,
        supplierResponseText: "Условия primary подтверждены письменно.",
      },
      sourceTestBasket: { id: fixture.basket.id, name: fixture.basket.name },
      copiedFromScenarioId: null,
      input,
      savedAt: occurredAt.toISOString(),
    });
    expect(saved.result).toEqual(calculateEconomics(input));
    expect(saved.result).toMatchObject({
      dealerBasketMinor: 4_119_500,
      clientBasketMinor: 5_005_600,
      discountMinor: 125_140,
      finalClientInvoiceMinor: 5_030_460,
      grossIncomeMinor: 500_247,
      directExpensesMinor: 20_000,
      netIncomeBeforeTaxMinor: 480_247,
    });

    const entries = context.db.select().from(activityLog).all();
    expect(entries).toHaveLength(1);
    const { id, createdAt, ...activity } = entries[0];
    expect(id).toBeGreaterThan(0);
    expect(createdAt).toBeInstanceOf(Date);
    expect(activity).toEqual({
      idempotencyKey: null,
      occurredAt,
      actor: "Ерасыл",
      contactType: "client",
      supplierId: fixture.supplier.id,
      clientId: fixture.client.id,
      contactName: `${fixture.client.name} → ${fixture.supplier.name}`,
      actionType: "economics_scenario_created",
      oldStatus: null,
      newStatus: "условия подтверждены",
      responseText: `IPANDA: кухня, комиссия 10,25%: доход до налогов ${formatMoneyMinor(480_247)}; режим — комиссия поставщика.`,
      nextAction: null,
      nextActionAt: null,
    });
  });

  it("не меняет сохранённый snapshot после правок клиента, поставщика, регистрации и корзины", () => {
    const fixture = insertFixture();
    const saved = saveFixtureScenario(fixture);
    const originalSnapshotJson = saved.scenario.snapshotJson;

    context.db
      .update(clients)
      .set({ name: "Новое имя клиента" })
      .where(eq(clients.id, fixture.client.id))
      .run();
    context.db
      .update(suppliers)
      .set({ name: "Новое имя поставщика" })
      .where(eq(suppliers.id, fixture.supplier.id))
      .run();
    context.db
      .update(clientRegistrations)
      .set({
        status: "условия отклонены",
        confirmedCommissionPercent: 1,
        confirmedRepeatCommissionMonths: 1,
        supplierResponseText: "Условия изменены после сохранения.",
      })
      .where(eq(clientRegistrations.id, fixture.registration.id))
      .run();
    context.db
      .update(testBaskets)
      .set({ name: "Пересчитанная корзина", dealerAmount: 1, rrpAmount: 2 })
      .where(eq(testBaskets.id, fixture.basket.id))
      .run();
    context.db
      .update(testBasketItems)
      .set({ product: "Другая позиция", sku: "CHANGED" })
      .where(eq(testBasketItems.id, fixture.basketItem.id))
      .run();

    const reloaded = getEconomicsScenarioById(saved.scenario.id, context.db);

    expect(reloaded).not.toBeNull();
    expect(reloaded?.scenario.snapshotJson).toBe(originalSnapshotJson);
    expect(reloaded?.snapshot).toEqual(saved.snapshot);
    expect(reloaded?.result).toEqual(saved.result);
    expect(reloaded?.snapshot.client.name).toBe("ТОО Чистая кухня primary");
    expect(reloaded?.snapshot.supplier.name).toBe("IPANDA primary");
    expect(reloaded?.snapshot.registration?.confirmedCommissionBps).toBe(1_025);
    expect(reloaded?.snapshot.sourceTestBasket?.name).toBe("Кухня IPANDA primary");
    expect(reloaded?.snapshot.input.lines[0].name).toBe(
      "Кухня с посудомоечной машиной",
    );
  });

  it("заменяет переданный snapshot при явном обновлении и журналирует изменение", () => {
    const fixture = insertFixture();
    const createdAt = new Date("2026-07-11T06:00:00.000Z");
    const updatedAt = new Date("2026-07-11T09:30:00.000Z");
    const created = saveFixtureScenario(fixture, scenarioInput(fixture.basketItem.id), createdAt);
    const updatedInput = scenarioInput(fixture.basketItem.id, {
      earningMode: "dealer_spread",
      discountBps: 500,
      commissionBps: 0,
      deliveryMinor: 200_000,
      deliveryPayer: "tamyz",
      otherDirectExpensesMinor: 30_000,
      termsStatus: "draft",
    });

    const updated = saveEconomicsScenario(
      {
        scenarioId: created.scenario.id,
        actor: "Димаш",
        clientId: fixture.client.id,
        supplierId: fixture.supplier.id,
        registrationId: fixture.registration.id,
        testBasketId: fixture.basket.id,
        title: "IPANDA: обновлённая дилерская разница",
        input: updatedInput,
        occurredAt: updatedAt,
      },
      context.db,
    );

    expect(updated.scenario.id).toBe(created.scenario.id);
    expect(updated.scenario.createdAt).toEqual(createdAt);
    expect(updated.scenario.updatedAt).toEqual(updatedAt);
    expect(updated.snapshot).toEqual({
      ...created.snapshot,
      title: "IPANDA: обновлённая дилерская разница",
      termsStatus: "draft",
      input: updatedInput,
      savedAt: updatedAt.toISOString(),
    });
    expect(updated.result).toEqual(calculateEconomics(updatedInput));
    expect(updated.result).not.toEqual(created.result);
    expect(context.db.select().from(economicsScenarios).all()).toHaveLength(1);

    const entries = context.db.select().from(activityLog).all();
    expect(entries.map(({ actionType }) => actionType)).toEqual([
      "economics_scenario_created",
      "economics_scenario_updated",
    ]);
    expect(entries[1]).toMatchObject({
      occurredAt: updatedAt,
      actor: "Димаш",
      clientId: fixture.client.id,
      supplierId: fixture.supplier.id,
      actionType: "economics_scenario_updated",
      oldStatus: "условия подтверждены",
      newStatus: "черновик условий",
      responseText: `IPANDA: обновлённая дилерская разница: доход до налогов ${formatMoneyMinor(updated.result.netIncomeBeforeTaxMinor)}; режим — дилерская разница.`,
    });
  });

  it("копирует сценарий на другого поставщика и сохраняет ссылку copiedFrom", () => {
    const fixture = insertFixture("source");
    const source = saveFixtureScenario(fixture);
    const alternative = insertSupplierTerms(fixture.client.id, "alternative");
    const copiedAt = new Date("2026-07-11T12:00:00.000Z");
    const copiedInput = scenarioInput(alternative.basketItem.id, {
      earningMode: "fixed_fee",
      discountBps: 100,
      commissionBps: 0,
      fixedFeeMinor: 750_000,
      minimumOrderMinor: 4_500_000,
      deliveryMinor: 0,
      deliveryPayer: "supplier",
      otherDirectExpensesMinor: 50_000,
      repeatOrdersPerMonthMilli: 2_000,
      repeatCommissionMonths: 6,
      commissionPaymentBusinessDays: 10,
    });

    const copied = saveEconomicsScenario(
      {
        copiedFromScenarioId: source.scenario.id,
        actor: "Димаш",
        clientId: fixture.client.id,
        supplierId: alternative.supplier.id,
        registrationId: alternative.registration.id,
        testBasketId: alternative.basket.id,
        title: "Копия: альтернативные условия",
        input: copiedInput,
        occurredAt: copiedAt,
      },
      context.db,
    );

    expect(copied.scenario.id).not.toBe(source.scenario.id);
    expect(copied.scenario.copiedFromScenarioId).toBe(source.scenario.id);
    expect(copied.snapshot.copiedFromScenarioId).toBe(source.scenario.id);
    expect(copied.snapshot.supplier).toEqual({
      id: alternative.supplier.id,
      name: alternative.supplier.name,
    });
    expect(copied.snapshot.registration?.id).toBe(alternative.registration.id);
    expect(copied.snapshot.sourceTestBasket?.id).toBe(alternative.basket.id);
    expect(copied.snapshot.input).toEqual(copiedInput);
    expect(copied.result).toEqual(calculateEconomics(copiedInput));
    expect(getEconomicsScenarioById(source.scenario.id, context.db)?.snapshot).toEqual(
      source.snapshot,
    );
  });

  it("откатывает сохранение сценария, если вставка в журнал не удалась", () => {
    const fixture = insertFixture();
    context.sqlite.exec(`
      CREATE TRIGGER fail_economics_activity
      BEFORE INSERT ON activity_log
      BEGIN
        SELECT RAISE(ABORT, 'forced activity failure');
      END;
    `);

    expect(() => saveFixtureScenario(fixture)).toThrow("forced activity failure");
    expect(context.db.select().from(economicsScenarios).all()).toHaveLength(0);
    expect(context.db.select().from(activityLog).all()).toHaveLength(0);
  });
});
