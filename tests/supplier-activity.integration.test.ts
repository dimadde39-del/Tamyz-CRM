import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = ":memory:";
});

import { activityLog, suppliers } from "@/db/schema";
import { updateSupplierWithActivity } from "@/db/services";

import { createTempDatabase, type TempDatabase } from "./helpers/temp-database";

describe("updateSupplierWithActivity", () => {
  let context: TempDatabase;

  beforeEach(async () => {
    context = await createTempDatabase();
  });

  afterEach(async () => {
    await context.cleanup();
  });

  function insertSupplier() {
    return context.db
      .insert(suppliers)
      .values({
        externalKey: "test-supplier-1",
        rank: 1,
        priority: "высокий",
        name: "Тестовый поставщик",
      })
      .returning()
      .get();
  }

  it("updates the supplier and writes the complete journal entry", () => {
    const supplier = insertSupplier();
    const occurredAt = new Date("2026-07-10T07:15:00.000Z");
    const nextActionAt = new Date("2026-07-11T04:00:00.000Z");

    const updated = updateSupplierWithActivity(
      {
        supplierId: supplier.id,
        actor: "Димаш",
        patch: {
          status: "передали менеджеру",
          lastContactAt: occurredAt,
          nextAction: "Написать региональному менеджеру",
          nextActionAt,
          internalComment: "Роль менеджера ещё не подтверждена",
        },
        responseText: "Контакт передан Ерлану",
        occurredAt,
        idempotencyKey: "test:forwarded-to-manager",
      },
      context.db,
    );

    expect(updated).toMatchObject({
      id: supplier.id,
      status: "передали менеджеру",
      originalResponse: "Контакт передан Ерлану",
      nextAction: "Написать региональному менеджеру",
      internalComment: "Роль менеджера ещё не подтверждена",
    });
    expect(updated.lastContactAt).toEqual(occurredAt);
    expect(updated.nextActionAt).toEqual(nextActionAt);

    const entries = context.db.select().from(activityLog).all();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actor: "Димаш",
      contactType: "supplier",
      supplierId: supplier.id,
      contactName: "Тестовый поставщик",
      actionType: "forwarded_to_manager",
      oldStatus: "не начато",
      newStatus: "передали менеджеру",
      responseText: "Контакт передан Ерлану",
      nextAction: "Написать региональному менеджеру",
      idempotencyKey: "test:forwarded-to-manager",
    });
    expect(entries[0].occurredAt).toEqual(occurredAt);
    expect(entries[0].nextActionAt).toEqual(nextActionAt);
  });

  it("rolls the supplier update back when the journal insert fails", () => {
    const supplier = insertSupplier();
    const originalUpdatedAt = supplier.updatedAt;
    context.sqlite.exec(`
      CREATE TRIGGER fail_activity_insert
      BEFORE INSERT ON activity_log
      BEGIN
        SELECT RAISE(ABORT, 'forced activity failure');
      END;
    `);

    expect(() =>
      updateSupplierWithActivity(
        {
          supplierId: supplier.id,
          actor: "Ерасыл",
          patch: {
            status: "сообщение отправлено",
            lastContactAt: new Date("2026-07-10T08:00:00.000Z"),
          },
          occurredAt: new Date("2026-07-10T08:00:00.000Z"),
        },
        context.db,
      ),
    ).toThrow();

    const unchanged = context.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, supplier.id))
      .get();
    expect(unchanged).toMatchObject({
      status: "не начато",
      lastContactAt: null,
    });
    expect(unchanged?.updatedAt).toEqual(originalUpdatedAt);
    expect(context.db.select().from(activityLog).all()).toHaveLength(0);
  });
});
