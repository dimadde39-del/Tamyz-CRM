import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
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

const LOCAL_DATABASE_URL = "./data/tamyz-ops.db";

function isVercelEphemeralSqlite(databaseUrl?: string): boolean {
  return databaseUrl === undefined && process.env.VERCEL === "1" && !process.env.DATABASE_URL;
}

function defaultDatabaseUrl(): string {
  if (isVercelEphemeralSqlite()) {
    return process.env.VERCEL_SQLITE_PATH ?? path.join(tmpdir(), "tamyz-ops.db");
  }

  return process.env.DATABASE_URL ?? LOCAL_DATABASE_URL;
}

export function getDatabasePath(
  databaseUrl = defaultDatabaseUrl(),
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

function seedVercelRuntimeDatabase(databasePath: string): void {
  const seedPath = process.env.VERCEL_SQLITE_SEED_PATH ?? "/var/task/data/tamyz-ops.db";
  if (!existsSync(/* turbopackIgnore: true */ seedPath)) {
    throw new Error(
      `Не найдена seed SQLite БД для Vercel: ${seedPath}. Проверьте outputFileTracingIncludes.`,
    );
  }

  mkdirSync(/* turbopackIgnore: true */ path.dirname(databasePath), { recursive: true });
  if (!existsSync(/* turbopackIgnore: true */ databasePath)) {
    copyFileSync(
      /* turbopackIgnore: true */ seedPath,
      /* turbopackIgnore: true */ databasePath,
    );
  }
}

export function createDatabase(databaseUrl?: string): DatabaseContext {
  const databasePath = getDatabasePath(databaseUrl);

  if (isVercelEphemeralSqlite(databaseUrl)) {
    seedVercelRuntimeDatabase(databasePath);
  } else if (databasePath !== ":memory:") {
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
