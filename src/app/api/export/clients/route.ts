import { asc } from "drizzle-orm";

import { db } from "@/db/client";
import { clients, type Client } from "@/db/schema";
import { csvDownloadResponse, toCsv, type CsvColumn } from "@/lib/export/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const columns = [
  { header: "ID", value: "id" },
  { header: "2GIS firm ID", value: "twoGisFirmId" },
  { header: "Ранг", value: "rank" },
  { header: "Название", value: "name" },
  { header: "Категория", value: "category" },
  { header: "Адрес", value: "address" },
  { header: "WhatsApp", value: "whatsapp" },
  { header: "WhatsApp (нормализованный)", value: "whatsappNormalized" },
  { header: "Телефон", value: "phone" },
  { header: "Email", value: "email" },
  { header: "Instagram", value: "instagram" },
  { header: "Telegram", value: "telegram" },
  { header: "VK", value: "vk" },
  { header: "Сайт", value: "website" },
  { header: "2GIS", value: "twoGisUrl" },
  { header: "Приоритет", value: "priority" },
  { header: "Обоснование приоритета", value: "priorityReason" },
  { header: "Confidence", value: "confidenceScore" },
  { header: "Обоснование confidence", value: "confidenceReason" },
  { header: "Качество контакта", value: "contactQuality" },
  { header: "Ответственный", value: "owner" },
  { header: "Статус", value: "status" },
  { header: "Текущий поставщик", value: "currentSupplier" },
  { header: "Проблема", value: "problem" },
  { header: "Дата следующего контакта", value: "nextContactAt" },
  { header: "Источник: активность", value: "sourceActivity" },
  { header: "Вероятные товары", value: "probableProducts" },
  { header: "Источник: частота закупки", value: "sourcePurchaseFrequency" },
  { header: "Лучший первый вопрос", value: "bestFirstQuestion" },
  { header: "Источник: текущая корзина", value: "sourceCurrentBasket" },
  { header: "Источник: текущий поставщик", value: "sourceCurrentSupplier" },
  { header: "Источник: объём закупки", value: "sourcePurchaseVolume" },
  { header: "Источник: ЛПР", value: "sourceDecisionMaker" },
  {
    header: "Нужна ручная проверка",
    value: (row) => (row.needsManualReview ? "да" : "нет"),
  },
  { header: "Причина ручной проверки", value: "manualReviewReason" },
  { header: "Автоматически найденные поля", value: "autoFoundFields" },
  { header: "Группа дублей", value: "duplicateGroup" },
  { header: "URL источника", value: "sourceUrl" },
  { header: "Ссылка на сырые данные", value: "rawData" },
  { header: "Метод сбора", value: "scrapeMethod" },
  { header: "Дата сбора", value: "scrapeDate" },
  { header: "Последняя проверка источника", value: "lastCheckedAt" },
  { header: "Дата импорта источника", value: "sourceImportedAt" },
  { header: "Создано", value: "createdAt" },
  { header: "Обновлено", value: "updatedAt" },
] satisfies readonly CsvColumn<Client>[];

export function GET(): Response {
  const rows = db
    .select()
    .from(clients)
    .orderBy(asc(clients.rank), asc(clients.id))
    .all();

  return csvDownloadResponse(toCsv(rows, columns), "tamyz-clients.csv");
}
