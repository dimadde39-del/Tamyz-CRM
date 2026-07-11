import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = ":memory:";
});

import {
  ClientRegistrationError,
  createClientRegistration,
  introduceClientToSupplier,
  markClientRegistrationRequestSent,
  recordClientRegistrationResponse,
} from "@/db/client-registration-service";
import { activityLog, clientRegistrations, clients, suppliers } from "@/db/schema";

import { createTempDatabase, type TempDatabase } from "./helpers/temp-database";

describe("регистрация клиента у поставщика", () => {
  let context: TempDatabase;

  beforeEach(async () => {
    context = await createTempDatabase();
  });

  afterEach(async () => {
    await context.cleanup();
  });

  function insertPair() {
    const client = context.db
      .insert(clients)
      .values({
        twoGisFirmId: "client-registration-test",
        rank: 1,
        priority: "высокий",
        name: "ТОО Чистый клиент",
        twoGisUrl: "https://2gis.kz/firm/client-registration-test",
      })
      .returning()
      .get();
    const supplier = context.db
      .insert(suppliers)
      .values({
        externalKey: "supplier-registration-test",
        rank: 1,
        priority: "высокий",
        name: "Поставщик защиты",
      })
      .returning()
      .get();
    return { client, supplier };
  }

  function createDraft() {
    const { client, supplier } = insertPair();
    const registration = createClientRegistration(
      {
        clientId: client.id,
        supplierId: supplier.id,
        actor: "Ерасыл",
        requestedCommissionPercent: 12.5,
        requestedRepeatCommissionMonths: 18,
        commissionPaymentBusinessDays: 5,
        occurredAt: new Date("2026-07-11T06:00:00.000Z"),
      },
      context.db,
    );
    return { client, supplier, registration };
  }

  it("проводит полный допустимый путь и пишет каждое изменение в журнал", () => {
    const { registration } = createDraft();
    const sentAt = new Date("2026-07-11T07:00:00.000Z");
    const confirmedAt = new Date("2026-07-11T08:00:00.000Z");
    const introducedAt = new Date("2026-07-11T09:00:00.000Z");

    expect(registration.status).toBe("черновик");
    expect(
      markClientRegistrationRequestSent(
        { registrationId: registration.id, actor: "Ерасыл", occurredAt: sentAt },
        context.db,
      ),
    ).toMatchObject({ status: "ожидает подтверждения", requestSentAt: sentAt });
    expect(
      recordClientRegistrationResponse(
        {
          registrationId: registration.id,
          actor: "Ерасыл",
          responseType: "confirmed",
          supplierResponseText: "Закрепление и условия подтверждаем.",
          confirmedCommissionPercent: 12.5,
          confirmedRepeatCommissionMonths: 18,
          occurredAt: confirmedAt,
        },
        context.db,
      ),
    ).toMatchObject({
      status: "подтверждён",
      confirmedCommissionPercent: 12.5,
      confirmedRepeatCommissionMonths: 18,
      confirmedAt,
    });
    expect(
      introduceClientToSupplier(
        { registrationId: registration.id, actor: "Ерасыл", occurredAt: introducedAt },
        context.db,
      ),
    ).toMatchObject({ status: "стороны познакомлены", introducedAt });

    const entries = context.db.select().from(activityLog).all();
    expect(entries.map((entry) => entry.actionType)).toEqual([
      "client_registration_created",
      "client_registration_requested",
      "client_registration_response_recorded",
      "client_introduction_recorded",
    ]);
    expect(entries.every((entry) => entry.clientId && entry.supplierId)).toBe(true);
  });

  it("не создаёт дубль для одной пары клиент + поставщик", () => {
    const { client, supplier } = createDraft();

    expect(() =>
      createClientRegistration(
        {
          clientId: client.id,
          supplierId: supplier.id,
          actor: "Димаш",
          requestedCommissionPercent: 10,
          requestedRepeatCommissionMonths: 12,
          commissionPaymentBusinessDays: 7,
        },
        context.db,
      ),
    ).toThrowError(ClientRegistrationError);
    expect(context.db.select().from(clientRegistrations).all()).toHaveLength(1);
    expect(context.db.select().from(activityLog).all()).toHaveLength(1);
  });

  it("запрещает знакомство до подтверждения", () => {
    const { registration } = createDraft();

    expect(() =>
      introduceClientToSupplier(
        { registrationId: registration.id, actor: "Ерасыл" },
        context.db,
      ),
    ).toThrow("Сначала нужно получить и зафиксировать подтверждение поставщика");
    expect(
      context.db
        .select()
        .from(clientRegistrations)
        .where(eq(clientRegistrations.id, registration.id))
        .get()?.status,
    ).toBe("черновик");
    expect(context.db.select().from(activityLog).all()).toHaveLength(1);
  });

  it.each([
    ["already_client", "уже является клиентом поставщика"],
    ["counteroffer", "условия отклонены"],
    ["refused", "условия отклонены"],
  ] as const)("фиксирует ответ %s со статусом %s", (responseType, expectedStatus) => {
    const { registration } = createDraft();
    markClientRegistrationRequestSent(
      { registrationId: registration.id, actor: "Ерасыл" },
      context.db,
    );

    const updated = recordClientRegistrationResponse(
      {
        registrationId: registration.id,
        actor: "Ерасыл",
        responseType,
        supplierResponseText: `Точный ответ: ${responseType}`,
        confirmedCommissionPercent: responseType === "counteroffer" ? 7 : null,
        confirmedRepeatCommissionMonths: responseType === "counteroffer" ? 6 : null,
      },
      context.db,
    );

    expect(updated).toMatchObject({
      status: expectedStatus,
      responseType,
      supplierResponseText: `Точный ответ: ${responseType}`,
    });
  });

  it("откатывает создание, если запись в журнал не удалась", () => {
    const { client, supplier } = insertPair();
    context.sqlite.exec(`
      CREATE TRIGGER fail_registration_activity
      BEFORE INSERT ON activity_log
      BEGIN
        SELECT RAISE(ABORT, 'forced activity failure');
      END;
    `);

    expect(() =>
      createClientRegistration(
        {
          clientId: client.id,
          supplierId: supplier.id,
          actor: "Ерасыл",
          requestedCommissionPercent: 10,
          requestedRepeatCommissionMonths: 12,
          commissionPaymentBusinessDays: 5,
        },
        context.db,
      ),
    ).toThrow();
    expect(context.db.select().from(clientRegistrations).all()).toHaveLength(0);
  });
});
