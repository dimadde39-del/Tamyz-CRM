import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { createDatabase, type DatabaseContext } from "@/db/client";

export interface TempDatabase extends DatabaseContext {
  directory: string;
  cleanup: () => Promise<void>;
}

export async function createTempDatabase(): Promise<TempDatabase> {
  const directory = await mkdtemp(path.join(tmpdir(), "tamyz-ops-vitest-"));
  const databasePath = path.join(directory, "test.db");
  const context = createDatabase(databasePath);

  try {
    migrate(context.db, {
      migrationsFolder: path.resolve(process.cwd(), "drizzle"),
    });
  } catch (error) {
    context.sqlite.close();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }

  return {
    ...context,
    directory,
    async cleanup() {
      context.sqlite.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
