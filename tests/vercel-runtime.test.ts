import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = ":memory:";
});

import { createDatabase } from "@/db/client";

describe("Vercel SQLite runtime", () => {
  let directory: string | undefined;
  let seed: ReturnType<typeof createDatabase> | undefined;
  let runtime: ReturnType<typeof createDatabase> | undefined;

  afterEach(async () => {
    runtime?.sqlite.close();
    seed?.sqlite.close();
    runtime = undefined;
    seed = undefined;
    vi.unstubAllEnvs();
    if (directory) await rm(directory, { recursive: true, force: true });
    directory = undefined;
  });

  it("copies the bundled seed database to a writable runtime path once", async () => {
    directory = await mkdtemp(path.join(tmpdir(), "tamyz-ops-vercel-"));
    const seedPath = path.join(directory, "bundle", "tamyz-ops.db");
    const runtimePath = path.join(directory, "runtime", "tamyz-ops.db");
    seed = createDatabase(seedPath);
    seed.sqlite.exec("CREATE TABLE serverless_probe (value TEXT NOT NULL)");
    seed.sqlite.exec("INSERT INTO serverless_probe (value) VALUES ('seeded')");
    seed.sqlite.close();
    seed = undefined;

    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("VERCEL_REGION", "iad1");
    vi.stubEnv("VERCEL_SQLITE_SEED_PATH", seedPath);
    vi.stubEnv("VERCEL_SQLITE_PATH", runtimePath);

    runtime = createDatabase();
    expect(existsSync(runtimePath)).toBe(true);
    expect(runtime.sqlite.prepare("SELECT value FROM serverless_probe").get()).toEqual({ value: "seeded" });

    runtime.sqlite.exec("INSERT INTO serverless_probe (value) VALUES ('runtime')");
    runtime.sqlite.close();
    runtime = undefined;

    const reused = createDatabase();
    expect(reused.sqlite.prepare("SELECT COUNT(*) AS count FROM serverless_probe").get()).toEqual({ count: 2 });
    reused.sqlite.close();
  });
});
