import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { dealers } from "@/db/schema";
import { importDealerResearch, readDealerResearch } from "@/lib/import/dealer-research";
import { importDealerWorkbook } from "@/lib/import/dealers";

import { createTempDatabase, type TempDatabase } from "./helpers/temp-database";

describe("TAMYZ Markdown dealer research import", () => {
  let context: TempDatabase;

  beforeEach(async () => {
    context = await createTempDatabase();
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it("parses the curated master with deterministic counts", async () => {
    const rows = await readDealerResearch();
    expect(rows).toHaveLength(47);
    expect(rows.filter((row) => row.priority === "A")).toHaveLength(20);
    expect(rows.filter((row) => row.priority === "B")).toHaveLength(16);
    expect(rows.filter((row) => row.priority === "C")).toHaveLength(11);
    expect(rows.filter((row) => row.phone)).toHaveLength(40);
    expect(rows.filter((row) => row.whatsappConfirmed && row.whatsapp)).toHaveLength(8);
    expect(rows.filter((row) => row.email)).toHaveLength(30);
  });

  it("upgrades legacy dealers, creates only new companies, and stays idempotent", async () => {
    await importDealerWorkbook({ database: context.db });
    const first = await importDealerResearch({ database: context.db });
    expect(first).toMatchObject({ total: 47, created: 26, updated: 21 });
    expect(context.db.select().from(dealers).all()).toHaveLength(47);

    const modus = context.db
      .select()
      .from(dealers)
      .where(eq(dealers.externalKey, "modus_foods_kazakhstan"))
      .get();
    expect(modus).toMatchObject({
      priority: "A",
      score: 90,
      confidence: "high",
      whatsappConfirmed: true,
      whatsappNormalized: "77066909190",
      status: "candidate",
    });

    const dudar = context.db
      .select()
      .from(dealers)
      .where(eq(dealers.externalKey, "dudar"))
      .get()!;
    context.db.update(dealers).set({ status: "interested" }).where(eq(dealers.id, dudar.id)).run();

    const second = await importDealerResearch({ database: context.db });
    expect(second).toMatchObject({ total: 47, created: 0, updated: 0, unchanged: 47 });
    expect(context.db.select().from(dealers).all()).toHaveLength(47);
    expect(context.db.select().from(dealers).where(eq(dealers.id, dudar.id)).get()?.status).toBe(
      "interested",
    );

    const legacyAfterResearch = await importDealerWorkbook({ database: context.db });
    expect(legacyAfterResearch).toMatchObject({ total: 21, created: 0, updated: 0, unchanged: 21 });
  });
});
