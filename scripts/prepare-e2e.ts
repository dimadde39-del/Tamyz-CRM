import { rm } from "node:fs/promises";
import path from "node:path";

async function main(): Promise<void> {
  const workspace = path.resolve(process.cwd());
  const target = path.resolve(workspace, ".next");

  if (path.dirname(target) !== workspace || path.basename(target) !== ".next") {
    throw new Error(`Отказ очищать небезопасный путь Next.js: ${target}`);
  }

  // A production build and a dev server share route manifests in .next.
  // Starting E2E from a clean generated directory prevents stale-route 404s.
  await rm(target, { recursive: true, force: true });
  process.stdout.write(`E2E Next.js output prepared: ${target}\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
