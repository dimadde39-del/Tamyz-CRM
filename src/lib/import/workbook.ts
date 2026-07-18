import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import JSZip from "jszip";

import { db, type TamyzDatabase } from "../../db/client";
import {
  clients,
  importRuns,
  suppliers,
  type Client,
  type NewClient,
  type NewSupplier,
  type Supplier,
} from "../../db/schema";
import { normalizePhoneNumber } from "../phone";
import {
  extractTwoGisFirmId,
  normalizeContactValue,
  normalizeHeader,
  normalizeInteger,
  normalizePriority,
  normalizeSourceValue,
  parseBooleanFlag,
  requireSourceValue,
} from "./normalization";

export const DEFAULT_SOURCE_WORKBOOK = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "data",
  "source",
  "shymkent_prof_chem_contacts.xlsx",
);

type SourceRow = Record<string, unknown>;

export interface SourceWorkbookData {
  suppliers: NewSupplier[];
  clients: NewClient[];
}

export interface ImportReport {
  runId: number;
  fileName: string;
  fileHash: string;
  suppliers: { total: number; created: number; updated: number; unchanged: number };
  clients: { total: number; created: number; updated: number; unchanged: number };
  errors: string[];
}

export interface ImportSourceWorkbookOptions {
  filePath?: string;
  database?: TamyzDatabase;
}

function rowsFromSheet(sheet: ExcelJS.Worksheet): SourceRow[] {
  const headers = new Map<number, string>();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, column) => {
    const header = normalizeHeader(cell.value);
    if (header) headers.set(column, header);
  });

  const rows: SourceRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const record: SourceRow = {};
    for (const [column, header] of headers) record[header] = row.getCell(column).value;
    if (Object.values(record).some((value) => normalizeSourceValue(value) !== null)) rows.push(record);
  }
  return rows;
}

function requiredInteger(value: unknown, label: string): number {
  const parsed = normalizeInteger(value);
  if (parsed === null) throw new Error(`Некорректное обязательное число «${label}»`);
  return parsed;
}

function supplierFromRow(row: SourceRow): NewSupplier {
  const whatsapp = normalizeContactValue(row.whatsapp);
  const phone = normalizeContactValue(row["телефон"]);
  return {
    externalKey: requireSourceValue(row.duplicate_group, "duplicate_group"),
    rank: requiredInteger(row.rank, "rank"),
    priority: normalizePriority(row["приоритет"]),
    priorityReason: normalizeSourceValue(row["обоснование приоритета"]),
    confidenceScore: normalizeInteger(row.confidence_score),
    confidenceReason: normalizeSourceValue(row.confidence_reason),
    contactQuality: normalizeSourceValue(row.contact_quality),
    name: requireSourceValue(row["название"], "название"),
    category: normalizeSourceValue(row["категория"]),
    country: normalizeSourceValue(row["страна"]),
    city: normalizeSourceValue(row["город"]),
    website: normalizeSourceValue(row["сайт"]),
    whatsapp,
    whatsappNormalized: normalizePhoneNumber(whatsapp),
    phone,
    email: normalizeContactValue(row.email),
    instagram: normalizeContactValue(row.instagram),
    telegram: normalizeContactValue(row.telegram),
    vk: normalizeContactValue(row.vk),
    partnershipProgram: normalizeSourceValue(row["партнёрская программа"]),
    partnershipUrl: normalizeSourceValue(row["ссылка партнёрства"]),
    sourceDelivery: normalizeSourceValue(row["доставка казахстан/шымкент"]),
    sourceMoq: normalizeSourceValue(row["цены/moq"]),
    sourceSds: normalizeSourceValue(row["сертификаты/sds"]),
    sourceAgencyScheme: normalizeSourceValue(row["агентская схема"]),
    sourceClientProtection: normalizeSourceValue(row["закрепление клиента"]),
    sourceCommission: normalizeSourceValue(row["комиссия"]),
    sourceRepeatCommission: normalizeSourceValue(row["повторная комиссия"]),
    potentialMargin: normalizeSourceValue(row["потенциальная маржа"]),
    weaknesses: normalizeSourceValue(row["слабые места"]),
    scrapeDate: normalizeSourceValue(row.scrape_date),
    lastCheckedAt: normalizeSourceValue(row.last_checked_at),
    scrapeMethod: normalizeSourceValue(row.scrape_method),
    needsManualReview: parseBooleanFlag(row.needs_manual_review) ?? false,
    manualReviewReason: normalizeSourceValue(row.manual_review_reason),
    autoFoundFields: normalizeSourceValue(row.auto_found_fields),
    sourceUrl: normalizeSourceValue(row.source_url),
    rawData: normalizeSourceValue(row.raw_data),
  };
}

function clientFromRow(row: SourceRow): NewClient {
  const twoGisUrl = requireSourceValue(row["2gis"], "2GIS");
  const twoGisFirmId = extractTwoGisFirmId(twoGisUrl);
  if (!twoGisFirmId) throw new Error(`Не удалось извлечь 2GIS firm id из «${twoGisUrl}»`);
  const whatsapp = normalizeContactValue(row.whatsapp);
  const phone = normalizeContactValue(row["телефон"]);
  return {
    twoGisFirmId,
    rank: requiredInteger(row.rank, "rank"),
    priority: normalizePriority(row["приоритет"]),
    priorityReason: normalizeSourceValue(row["обоснование приоритета"]),
    confidenceScore: normalizeInteger(row.confidence_score),
    confidenceReason: normalizeSourceValue(row.confidence_reason),
    contactQuality: normalizeSourceValue(row.contact_quality),
    name: requireSourceValue(row["название"], "название"),
    category: normalizeSourceValue(row["категория"]),
    address: normalizeSourceValue(row["адрес"]),
    whatsapp,
    whatsappNormalized: normalizePhoneNumber(whatsapp),
    phone,
    email: normalizeContactValue(row.email),
    instagram: normalizeContactValue(row.instagram),
    telegram: normalizeContactValue(row.telegram),
    vk: normalizeContactValue(row.vk),
    website: normalizeSourceValue(row["сайт"]),
    twoGisUrl,
    sourceActivity: normalizeSourceValue(row["активность"]),
    probableProducts: normalizeSourceValue(row["вероятные товары"]),
    sourcePurchaseFrequency: normalizeSourceValue(row["частота закупки"]),
    bestFirstQuestion: normalizeSourceValue(row["лучший первый вопрос"]),
    sourceCurrentBasket: normalizeSourceValue(row["текущая корзина"]),
    sourceCurrentSupplier: normalizeSourceValue(row["текущий поставщик"]),
    sourcePurchaseVolume: normalizeSourceValue(row["объём закупки"]),
    sourceDecisionMaker: normalizeSourceValue(row["лпр"]),
    scrapeDate: normalizeSourceValue(row.scrape_date),
    lastCheckedAt: normalizeSourceValue(row.last_checked_at),
    scrapeMethod: normalizeSourceValue(row.scrape_method),
    needsManualReview: parseBooleanFlag(row.needs_manual_review) ?? false,
    manualReviewReason: normalizeSourceValue(row.manual_review_reason),
    autoFoundFields: normalizeSourceValue(row.auto_found_fields),
    duplicateGroup: normalizeSourceValue(row.duplicate_group),
    sourceUrl: normalizeSourceValue(row.source_url),
    rawData: normalizeSourceValue(row.raw_data),
  };
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`В XLSX есть дубли ключа ${label}`);
}

export async function readSourceWorkbook(
  filePath = DEFAULT_SOURCE_WORKBOOK,
): Promise<SourceWorkbookData> {
  const input = await readFile(/* turbopackIgnore: true */ filePath);
  const archive = await JSZip.loadAsync(input);
  const xmlEntries = Object.values(archive.files).filter(
    (entry) => !entry.dir && entry.name.startsWith("xl/") && entry.name.endsWith(".xml"),
  );
  await Promise.all(
    xmlEntries.map(async (entry) => {
      const xml = await entry.async("string");
      if (!xml.includes("xmlns:x=")) return;
      archive.file(
        entry.name,
        xml.replace(/(<\/?)(x:)/g, "$1").replace(/\sxmlns:x=/, " xmlns="),
      );
    }),
  );

  const workbook = new ExcelJS.Workbook();
  const compatibleArchive = await archive.generateAsync({ type: "uint8array" });
  await workbook.xlsx.load(Uint8Array.from(compatibleArchive).buffer, {
    ignoreNodes: ["tableParts", "drawing", "picture", "legacyDrawing"],
  });
  const supplierSheet = workbook.getWorksheet("ПОСТАВЩИКИ");
  const clientSheet = workbook.getWorksheet("КЛИЕНТЫ");
  if (!supplierSheet || !clientSheet) throw new Error("В XLSX отсутствуют листы ПОСТАВЩИКИ/КЛИЕНТЫ");

  const supplierRows = rowsFromSheet(supplierSheet).map(supplierFromRow);
  const clientRows = rowsFromSheet(clientSheet).map(clientFromRow);
  assertUnique(supplierRows.map((row) => row.externalKey), "supplier duplicate_group");
  assertUnique(clientRows.map((row) => row.twoGisFirmId), "client 2GIS firm id");
  return { suppliers: supplierRows, clients: clientRows };
}

function sourceChanged(existing: Supplier | Client, incoming: NewSupplier | NewClient): boolean {
  const current = existing as unknown as Record<string, unknown>;
  return Object.entries(incoming).some(([key, value]) => current[key] !== value);
}

export async function importSourceWorkbook(
  options: ImportSourceWorkbookOptions = {},
): Promise<ImportReport> {
  const database = options.database ?? db;
  const filePath = options.filePath ?? DEFAULT_SOURCE_WORKBOOK;
  const hash = createHash("sha256")
    .update(await readFile(/* turbopackIgnore: true */ filePath))
    .digest("hex");
  const startedAt = new Date();
  const run = database
    .insert(importRuns)
    .values({ fileName: path.basename(filePath), fileHash: hash, startedAt, status: "running" })
    .returning({ id: importRuns.id })
    .get();

  try {
    const source = await readSourceWorkbook(filePath);
    const counts = { suppliersCreated: 0, suppliersUpdated: 0, suppliersUnchanged: 0, clientsCreated: 0, clientsUpdated: 0, clientsUnchanged: 0 };
    database.transaction((tx) => {
      const existingSuppliers = new Map(tx.select().from(suppliers).all().map((row) => [row.externalKey, row]));
      for (const row of source.suppliers) {
        const existing = existingSuppliers.get(row.externalKey);
        if (!existing) {
          tx.insert(suppliers).values({ ...row, sourceImportedAt: startedAt }).run();
          counts.suppliersCreated += 1;
        } else if (sourceChanged(existing, row)) {
          tx.update(suppliers).set({ ...row, sourceImportedAt: startedAt }).where(eq(suppliers.id, existing.id)).run();
          counts.suppliersUpdated += 1;
        } else counts.suppliersUnchanged += 1;
      }

      const existingClients = new Map(tx.select().from(clients).all().map((row) => [row.twoGisFirmId, row]));
      for (const row of source.clients) {
        const existing = existingClients.get(row.twoGisFirmId);
        if (!existing) {
          tx.insert(clients).values({ ...row, sourceImportedAt: startedAt }).run();
          counts.clientsCreated += 1;
        } else if (sourceChanged(existing, row)) {
          tx.update(clients).set({ ...row, sourceImportedAt: startedAt }).where(eq(clients.id, existing.id)).run();
          counts.clientsUpdated += 1;
        } else counts.clientsUnchanged += 1;
      }
    });

    const finishedAt = new Date();
    database.update(importRuns).set({ ...counts, status: "completed", finishedAt }).where(eq(importRuns.id, run.id)).run();
    return {
      runId: run.id,
      fileName: path.basename(filePath),
      fileHash: hash,
      suppliers: { total: source.suppliers.length, created: counts.suppliersCreated, updated: counts.suppliersUpdated, unchanged: counts.suppliersUnchanged },
      clients: { total: source.clients.length, created: counts.clientsCreated, updated: counts.clientsUpdated, unchanged: counts.clientsUnchanged },
      errors: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    database.update(importRuns).set({ status: "failed", errorsJson: JSON.stringify([message]), finishedAt: new Date() }).where(eq(importRuns.id, run.id)).run();
    throw error;
  }
}
