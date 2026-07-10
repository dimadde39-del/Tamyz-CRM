import { mkdirSync } from "node:fs";
import path from "node:path";

import Sqlite from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

export type TamyzDatabase = BetterSQLite3Database<typeof schema>;
export type SqliteClient = InstanceType<typeof Sqlite>;

export interface DatabaseContext {
  db: TamyzDatabase;
  sqlite: SqliteClient;
  path: string;
}

export function getDatabasePath(
  databaseUrl = process.env.DATABASE_URL ?? "./data/tamyz-ops.db",
): string {
  const withoutProtocol = databaseUrl.startsWith("file:")
    ? databaseUrl.slice("file:".length)
    : databaseUrl;

  if (withoutProtocol === ":memory:") {
    return withoutProtocol;
  }

  return path.isAbsolute(withoutProtocol)
    ? path.normalize(withoutProtocol)
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), withoutProtocol);
}

export function createDatabase(databaseUrl?: string): DatabaseContext {
  const databasePath = getDatabasePath(databaseUrl);

  if (databasePath !== ":memory:") {
    mkdirSync(/* turbopackIgnore: true */ path.dirname(databasePath), { recursive: true });
  }

  const sqliteClient = new Sqlite(/* turbopackIgnore: true */ databasePath);
  sqliteClient.pragma("foreign_keys = ON");
  sqliteClient.pragma("busy_timeout = 5000");

  if (databasePath !== ":memory:") {
    sqliteClient.pragma("journal_mode = WAL");
  }

  return {
    db: drizzle(sqliteClient, { schema }),
    sqlite: sqliteClient,
    path: databasePath,
  };
}

const defaultContext = createDatabase();

export const db = defaultContext.db;
export const sqlite = defaultContext.sqlite;
export const databasePath = defaultContext.path;
