import { sqlite } from "../src/db/client";
import { applyJuly10FieldUpdate } from "../src/db/field-update";
import { seedKdsOperationalRecord } from "../src/db/services";
import { importDealerResearch } from "../src/lib/import/dealer-research";
import { importDealerWorkbook } from "../src/lib/import/dealers";
import { importSourceWorkbook } from "../src/lib/import/workbook";

async function main(): Promise<void> {
  try {
    const report = await importSourceWorkbook();
    const dealers = await importDealerWorkbook();
    const dealerResearch = await importDealerResearch();
    const kds = seedKdsOperationalRecord();
    const fieldUpdate = applyJuly10FieldUpdate();
    process.stdout.write(
      `${JSON.stringify({ import: report, dealers, dealerResearch, kds: { id: kds.id, status: kds.status }, fieldUpdate }, null, 2)}\n`,
    );
  } finally {
    sqlite.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
