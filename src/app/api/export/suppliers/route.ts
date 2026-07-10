import { asc } from "drizzle-orm";

import { db } from "@/db/client";
import { suppliers, type Supplier } from "@/db/schema";
import {
  getQualificationResult,
  QUALIFICATION_RESULT_LABELS,
  TRI_STATE_LABELS,
} from "@/lib/domain";
import { csvDownloadResponse, toCsv, type CsvColumn } from "@/lib/export/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const columns = [
  { header: "ID", value: "id" },
  { header: "Внешний ключ", value: "externalKey" },
  { header: "Ранг", value: "rank" },
  { header: "Название", value: "name" },
  { header: "Категория", value: "category" },
  { header: "Страна", value: "country" },
  { header: "Город", value: "city" },
  { header: "Сайт", value: "website" },
  { header: "WhatsApp", value: "whatsapp" },
  { header: "WhatsApp (нормализованный)", value: "whatsappNormalized" },
  { header: "Телефон", value: "phone" },
  { header: "Email", value: "email" },
  { header: "Instagram", value: "instagram" },
  { header: "Telegram", value: "telegram" },
  { header: "VK", value: "vk" },
  { header: "Приоритет", value: "priority" },
  { header: "Обоснование приоритета", value: "priorityReason" },
  { header: "Confidence", value: "confidenceScore" },
  { header: "Обоснование confidence", value: "confidenceReason" },
  { header: "Качество контакта", value: "contactQuality" },
  { header: "Ответственный", value: "owner" },
  { header: "Статус", value: "status" },
  { header: "Последний контакт", value: "lastContactAt" },
  { header: "Дата следующего действия", value: "nextActionAt" },
  { header: "Следующее действие", value: "nextAction" },
  { header: "Исходный ответ", value: "originalResponse" },
  { header: "Внутренний комментарий", value: "internalComment" },
  {
    header: "Итог квалификации",
    value: (row) => QUALIFICATION_RESULT_LABELS[getQualificationResult(row)],
  },
  {
    header: "Есть представитель в Шымкенте",
    value: (row) => TRI_STATE_LABELS[row.hasShymkentRepresentative],
  },
  { header: "Кто принимает решение", value: "decisionMaker" },
  {
    header: "Агентский формат возможен",
    value: (row) => TRI_STATE_LABELS[row.agencyFormatPossible],
  },
  {
    header: "Закупка на склад не требуется",
    value: (row) => TRI_STATE_LABELS[row.noStockPurchaseRequired],
  },
  {
    header: "Поставщик выставляет счёт клиенту",
    value: (row) => TRI_STATE_LABELS[row.supplierInvoicesClient],
  },
  {
    header: "Поставщик доставляет клиенту",
    value: (row) => TRI_STATE_LABELS[row.supplierDeliversClient],
  },
  {
    header: "Комиссия с первого заказа",
    value: (row) => TRI_STATE_LABELS[row.commissionFirstOrder],
  },
  {
    header: "Комиссия с повторных заказов",
    value: (row) => TRI_STATE_LABELS[row.commissionRepeatOrders],
  },
  {
    header: "Защита клиента подтверждена",
    value: (row) => TRI_STATE_LABELS[row.clientProtectionConfirmed],
  },
  { header: "Механизм закрепления клиента", value: "clientProtectionMechanism" },
  { header: "Срок защиты клиента", value: "clientProtectionTerm" },
  { header: "MOQ", value: "qualifiedMoq" },
  {
    header: "Образцы доступны",
    value: (row) => TRI_STATE_LABELS[row.samplesAvailable],
  },
  { header: "Комментарий по образцам", value: "samplesComment" },
  {
    header: "Прайс получен",
    value: (row) => TRI_STATE_LABELS[row.priceReceived],
  },
  {
    header: "Документы/SDS получены",
    value: (row) => TRI_STATE_LABELS[row.documentsSdsReceived],
  },
  { header: "Комментарий по логистике", value: "logisticsComment" },
  { header: "Источник: партнёрская программа", value: "partnershipProgram" },
  { header: "Источник: ссылка партнёрства", value: "partnershipUrl" },
  { header: "Источник: доставка", value: "sourceDelivery" },
  { header: "Источник: цены/MOQ", value: "sourceMoq" },
  { header: "Источник: сертификаты/SDS", value: "sourceSds" },
  { header: "Источник: агентская схема", value: "sourceAgencyScheme" },
  { header: "Источник: закрепление клиента", value: "sourceClientProtection" },
  { header: "Источник: комиссия", value: "sourceCommission" },
  { header: "Источник: повторная комиссия", value: "sourceRepeatCommission" },
  { header: "Потенциальная маржа", value: "potentialMargin" },
  { header: "Слабые места", value: "weaknesses" },
  {
    header: "Нужна ручная проверка",
    value: (row) => (row.needsManualReview ? "да" : "нет"),
  },
  { header: "Причина ручной проверки", value: "manualReviewReason" },
  { header: "Автоматически найденные поля", value: "autoFoundFields" },
  { header: "URL источника", value: "sourceUrl" },
  { header: "Ссылка на сырые данные", value: "rawData" },
  { header: "Метод сбора", value: "scrapeMethod" },
  { header: "Дата сбора", value: "scrapeDate" },
  { header: "Последняя проверка источника", value: "lastCheckedAt" },
  { header: "Дата импорта источника", value: "sourceImportedAt" },
  { header: "Создано", value: "createdAt" },
  { header: "Обновлено", value: "updatedAt" },
] satisfies readonly CsvColumn<Supplier>[];

export function GET(): Response {
  const rows = db
    .select()
    .from(suppliers)
    .orderBy(asc(suppliers.rank), asc(suppliers.id))
    .all();

  return csvDownloadResponse(toCsv(rows, columns), "tamyz-suppliers.csv");
}
