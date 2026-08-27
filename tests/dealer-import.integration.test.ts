import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { dealers } from "@/db/schema";
import { importDealerWorkbook } from "@/lib/import/dealers";

import { createTempDatabase, type TempDatabase } from "./helpers/temp-database";

describe("SCANDIC dealer import", () => {
  let context: TempDatabase;

  beforeEach(async () => {
    context = await createTempDatabase();
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it("imports the dealer sheet idempotently and preserves operator status", async () => {
    const first = await importDealerWorkbook({ database: context.db });
    expect(first.total).toBe(21);
    expect(first.created).toBe(21);
    expect(context.db.select().from(dealers).all()).toHaveLength(21);

    const beverage = context.db
      .select()
      .from(dealers)
      .where(eq(dealers.externalKey, "beverage_trade_fbs"))
      .get();
    expect(beverage).toMatchObject({
      name: "Beverage Trade / FBS Group",
      city: "Шымкент",
      priority: "A",
      status: "candidate",
      whatsappNormalized: "77000900022",
    });

    context.db
      .update(dealers)
      .set({ status: "interested" })
      .where(eq(dealers.id, beverage!.id))
      .run();

    const second = await importDealerWorkbook({ database: context.db });
    expect(second).toMatchObject({ total: 21, created: 0 });
    expect(context.db.select().from(dealers).all()).toHaveLength(21);
    expect(
      context.db.select().from(dealers).where(eq(dealers.id, beverage!.id)).get()?.status,
    ).toBe("interested");
  });
});
