import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { seedKdsOperationalRecord } from "@/db/services";
import { importSourceWorkbook } from "@/lib/import/workbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  let temporaryPath: string | null = null;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (file instanceof File && file.size > 0) {
        if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) {
          return Response.json({ error: "Поддерживается только файл .xlsx" }, { status: 400 });
        }
        if (file.size > MAX_FILE_BYTES) {
          return Response.json({ error: "Файл превышает лимит 10 МБ" }, { status: 413 });
        }
        const directory = path.resolve(process.cwd(), "data/imports");
        await mkdir(directory, { recursive: true });
        temporaryPath = path.join(directory, `${randomUUID()}.xlsx`);
        await writeFile(temporaryPath, new Uint8Array(await file.arrayBuffer()));
      }
    }

    const report = await importSourceWorkbook(temporaryPath ? { filePath: temporaryPath } : {});
    seedKdsOperationalRecord();
    return Response.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось импортировать XLSX";
    return Response.json({ error: message }, { status: 422 });
  } finally {
    if (temporaryPath) await unlink(temporaryPath).catch(() => undefined);
  }
}
