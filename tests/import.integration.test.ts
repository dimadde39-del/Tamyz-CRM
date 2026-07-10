import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = ":memory:";
});

import { activityLog, clients, importRuns, suppliers } from "@/db/schema";
import {
  KDS_COMMENT,
  KDS_EXTERNAL_KEY,
  KDS_NEXT_ACTION,
  KDS_RESPONSE,
  seedKdsOperationalRecord,
} from "@/db/services";
import {
  DEFAULT_SOURCE_WORKBOOK,
  importSourceWorkbook,
  readSourceWorkbook,
} from "@/lib/import/workbook";

import { createTempDatabase, type TempDatabase } from "./helpers/temp-database";

describe("real source workbook import", () => {
  let context: TempDatabase;

  beforeEach(async () => {
    context = await createTempDatabase();
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it("parses the deduplicated workbook with stable source identities", async () => {
    const source = await readSourceWorkbook(DEFAULT_SOURCE_WORKBOOK);

    expect(source.suppliers).toHaveLength(61);
    expect(source.clients).toHaveLength(250);
    expect(new Set(source.suppliers.map((supplier) => supplier.externalKey)).size).toBe(61);
    expect(new Set(source.clients.map((client) => client.twoGisFirmId)).size).toBe(250);

    const doscarLocations = source.clients.filter((client) => client.name === "DOSCAR");
    expect(doscarLocations).toHaveLength(2);
    expect(new Set(doscarLocations.map((client) => client.twoGisFirmId)).size).toBe(2);
  });

  it("imports 61 suppliers and 250 clients idempotently without erasing KDS operations", async () => {
    const first = await importSourceWorkbook({
      filePath: DEFAULT_SOURCE_WORKBOOK,
      database: context.db,
    });

    expect(first.suppliers).toEqual({ total: 61, created: 61, updated: 0, unchanged: 0 });
    expect(first.clients).toEqual({ total: 250, created: 250, updated: 0, unchanged: 0 });
    expect(context.db.select().from(suppliers).all()).toHaveLength(61);
    expect(context.db.select().from(clients).all()).toHaveLength(250);

    vi.useFakeTimers();
    const seededKds = (() => {
      try {
        vi.setSystemTime(new Date("2026-07-10T07:00:00.000Z"));
        return seedKdsOperationalRecord(context.db);
      } finally {
        vi.useRealTimers();
      }
    })();

    expect(seededKds.name).toBe("КДС-Алматы");
    expect(seededKds.status).toBe("передали менеджеру");
    expect(seededKds.originalResponse).toBe(KDS_RESPONSE);
    expect(seededKds.internalComment).toBe(KDS_COMMENT);
    expect(seededKds.nextAction).toBe(KDS_NEXT_ACTION);
    expect(context.db.select().from(activityLog).all()).toHaveLength(3);

    const supplierIdsBefore = context.db
      .select({ id: suppliers.id })
      .from(suppliers)
      .all()
      .map(({ id }) => id);
    const clientIdsBefore = context.db
      .select({ id: clients.id })
      .from(clients)
      .all()
      .map(({ id }) => id);

    const second = await importSourceWorkbook({
      filePath: DEFAULT_SOURCE_WORKBOOK,
      database: context.db,
    });

    expect(second.suppliers).toEqual({ total: 61, created: 0, updated: 0, unchanged: 61 });
    expect(second.clients).toEqual({ total: 250, created: 0, updated: 0, unchanged: 250 });
    expect(
      context.db
        .select({ id: suppliers.id })
        .from(suppliers)
        .all()
        .map(({ id }) => id),
    ).toEqual(supplierIdsBefore);
    expect(
      context.db
        .select({ id: clients.id })
        .from(clients)
        .all()
        .map(({ id }) => id),
    ).toEqual(clientIdsBefore);

    const kdsRows = context.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.externalKey, KDS_EXTERNAL_KEY))
      .all();
    expect(kdsRows).toHaveLength(1);
    expect(kdsRows[0]).toMatchObject({
      name: "КДС-Алматы",
      status: "передали менеджеру",
      originalResponse: KDS_RESPONSE,
      internalComment: KDS_COMMENT,
      nextAction: KDS_NEXT_ACTION,
    });
    expect(context.db.select().from(activityLog).all()).toHaveLength(3);
    expect(context.db.select().from(importRuns).all()).toHaveLength(2);
  });
});
