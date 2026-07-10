import { desc } from "drizzle-orm";

import { db } from "@/db/client";
import { activityLog, type ActivityLogEntry } from "@/db/schema";
import { csvDownloadResponse, toCsv, type CsvColumn } from "@/lib/export/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const columns = [
  { header: "ID", value: "id" },
  { header: "Дата и время", value: "occurredAt" },
  { header: "Пользователь", value: "actor" },
  {
    header: "Тип контакта",
    value: (row) => (row.contactType === "supplier" ? "поставщик" : "клиент"),
  },
  { header: "ID поставщика", value: "supplierId" },
  { header: "ID клиента", value: "clientId" },
  { header: "Контакт", value: "contactName" },
  { header: "Тип действия", value: "actionType" },
  { header: "Старый статус", value: "oldStatus" },
  { header: "Новый статус", value: "newStatus" },
  { header: "Текст ответа", value: "responseText" },
  { header: "Следующее действие", value: "nextAction" },
  { header: "Дата следующего действия", value: "nextActionAt" },
  { header: "Ключ идемпотентности", value: "idempotencyKey" },
  { header: "Создано", value: "createdAt" },
] satisfies readonly CsvColumn<ActivityLogEntry>[];

export function GET(): Response {
  const rows = db
    .select()
    .from(activityLog)
    .orderBy(desc(activityLog.occurredAt), desc(activityLog.id))
    .all();

  return csvDownloadResponse(toCsv(rows, columns), "tamyz-activities.csv");
}
