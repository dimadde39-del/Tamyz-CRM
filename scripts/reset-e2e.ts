import { unlink } from "node:fs/promises";
import path from "node:path";

async function main(): Promise<void> {
  const workspace = process.cwd();
  const target = path.resolve(
    workspace,
    process.env.E2E_DATABASE_URL ?? "./data/tamyz-ops-e2e.db",
  );
  const allowedRoot = `${path.resolve(workspace, "data")}${path.sep}`;

  if (
    !target.startsWith(allowedRoot) ||
    !target.toLocaleLowerCase().endsWith(".db") ||
    !target.toLocaleLowerCase().includes("e2e")
  ) {
    throw new Error(`Отказ удалять небезопасный путь E2E DB: ${target}`);
  }

  for (const suffix of ["", "-wal", "-shm"]) {
    await unlink(`${target}${suffix}`).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  process.env.DATABASE_URL = target;
  const [
    { db, sqlite },
    { migrate },
    { seedKdsOperationalRecord },
    { importDealerWorkbook },
    { importSourceWorkbook },
    { applyJuly10FieldUpdate },
  ] = await Promise.all([
    import("../src/db/client"),
    import("drizzle-orm/better-sqlite3/migrator"),
    import("../src/db/services"),
    import("../src/lib/import/dealers"),
    import("../src/lib/import/workbook"),
    import("../src/db/field-update"),
  ]);

  try {
    migrate(db, { migrationsFolder: path.resolve(workspace, "drizzle") });
    const report = await importSourceWorkbook();
    const dealerReport = await importDealerWorkbook({ database: db });
    seedKdsOperationalRecord();
    applyJuly10FieldUpdate(db);
    process.stdout.write(`${JSON.stringify({ ...report, dealers: dealerReport }, null, 2)}\n`);
  } finally {
    sqlite.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
