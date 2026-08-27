import { readFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import JSZip from "jszip";

import { db, type TamyzDatabase } from "../../db/client";
import { dealers, type Dealer, type NewDealer } from "../../db/schema";
import { DEALER_PRIORITIES, type DealerPriority } from "../domain";
import { normalizePhoneNumber, splitPhoneNumbers } from "../phone";
import {
  normalizeContactValue,
  normalizeHeader,
  normalizeSourceValue,
  requireSourceValue,
} from "./normalization";

export const DEFAULT_DEALER_WORKBOOK = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "data",
  "source",
  "SCANDIC_Shymkent_market_research_2026-08-11.xlsx",
);

const DEALER_SOURCE = "SCANDIC Shymkent market research 2026-08-11";

type SourceRow = Record<string, unknown>;

export interface DealerImportReport {
  fileName: string;
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  withPhone: number;
  withoutPhone: number;
}

export interface ImportDealerWorkbookOptions {
  filePath?: string;
  database?: TamyzDatabase;
}

function normalizeCompanyName(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9әіңғүұқөһ]+/gi, "")
    .trim();
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
    if (normalizeSourceValue(record["дилер"])) rows.push(record);
  }
  return rows;
}

function parsePriority(value: unknown): DealerPriority {
  const priority = normalizeSourceValue(value)?.toUpperCase();
  const match = DEALER_PRIORITIES.find((item) => item === priority);
  if (!match) throw new Error(`Неизвестный приоритет дилера: ${String(value)}`);
  return match;
}

function isLikelyMobile(candidate: string): boolean {
  const normalized = normalizePhoneNumber(candidate);
  return Boolean(normalized && /^7(?:700|701|702|705|706|707|708|747|771|775|776|777|778)/.test(normalized));
}

function dealerFromRow(row: SourceRow, rank: number): NewDealer {
  const name = requireSourceValue(row["дилер"], "Дилер");
  const sourcePhones = splitPhoneNumbers(normalizeContactValue(row["телефон"]));
  const explicitWhatsApp = splitPhoneNumbers(normalizeContactValue(row.whatsapp))[0] ?? null;
  const whatsapp = explicitWhatsApp ?? sourcePhones.find(isLikelyMobile) ?? null;
  const notes = [
    normalizeSourceValue(row["общая пригодность"]),
    normalizeSourceValue(row["почему в топ-10"])
      ? `Почему в топ-10: ${normalizeSourceValue(row["почему в топ-10"])}`
      : null,
    normalizeSourceValue(row["что неизвестно"])
      ? `Проверить: ${normalizeSourceValue(row["что неизвестно"])}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return {
    externalKey: requireSourceValue(row.id, "ID"),
    normalizedName: normalizeCompanyName(name),
    normalizedPhone: normalizePhoneNumber(sourcePhones.join("; ")),
    rank,
    name,
    legalName: normalizeSourceValue(row["юр. название"]),
    city: "Шымкент",
    address: normalizeSourceValue(row["адрес / склад шымкент"]),
    phone: sourcePhones[0] ?? null,
    additionalPhones: sourcePhones.slice(1).join("; ") || null,
    whatsapp,
    whatsappNormalized: normalizePhoneNumber(whatsapp),
    email: normalizeContactValue(row.email),
    website: normalizeSourceValue(row["сайт"]),
    social: normalizeSourceValue(row["соцсети"]),
    priority: parsePriority(row["рейтинг"]),
    note: notes.join("\n\n") || null,
    source: DEALER_SOURCE,
    sourceUrl: normalizeSourceValue(row["источники"]),
    sourceCheckedAt: normalizeSourceValue(row["дата проверки"]),
  };
}

async function loadWorkbook(filePath: string): Promise<ExcelJS.Workbook> {
  const input = await readFile(/* turbopackIgnore: true */ filePath);
  const archive = await JSZip.loadAsync(input);
  const xmlEntries = Object.values(archive.files).filter(
    (entry) => !entry.dir && entry.name.startsWith("xl/") && entry.name.endsWith(".xml"),
  );
  await Promise.all(
    xmlEntries.map(async (entry) => {
      const xml = await entry.async("string");
      if (!xml.includes("xmlns:x=")) return;
      archive.file(entry.name, xml.replace(/(<\/?)(x:)/g, "$1").replace(/\sxmlns:x=/, " xmlns="));
    }),
  );

  const workbook = new ExcelJS.Workbook();
  const compatibleArchive = await archive.generateAsync({ type: "uint8array" });
  await workbook.xlsx.load(Uint8Array.from(compatibleArchive).buffer, {
    ignoreNodes: ["tableParts", "drawing", "picture", "legacyDrawing"],
  });
  return workbook;
}

export async function readDealerWorkbook(filePath = DEFAULT_DEALER_WORKBOOK): Promise<NewDealer[]> {
  const workbook = await loadWorkbook(filePath);
  const sheet = workbook.getWorksheet("Дилеры");
  if (!sheet) throw new Error("В XLSX отсутствует лист «Дилеры»");
  const rows = rowsFromSheet(sheet).map((row, index) => dealerFromRow(row, index + 1));
  const names = rows.map((row) => row.normalizedName);
  if (new Set(names).size !== names.length) throw new Error("В XLSX есть дубли нормализованных названий дилеров");
  return rows;
}

function sourceChanged(existing: Dealer, incoming: NewDealer): boolean {
  const current = existing as unknown as Record<string, unknown>;
  return Object.entries(incoming).some(([key, value]) => current[key] !== value);
}

export async function importDealerWorkbook(
  options: ImportDealerWorkbookOptions = {},
): Promise<DealerImportReport> {
  const database = options.database ?? db;
  const filePath = options.filePath ?? DEFAULT_DEALER_WORKBOOK;
  const source = await readDealerWorkbook(filePath);
  const counts = { created: 0, updated: 0, unchanged: 0 };
  const importedAt = new Date();

  database.transaction((tx) => {
    const existingRows = tx.select().from(dealers).all();
    const byKey = new Map(existingRows.map((row) => [row.externalKey, row]));
    const byName = new Map(existingRows.map((row) => [row.normalizedName, row]));
    const byPhone = new Map(
      existingRows.filter((row) => row.normalizedPhone).map((row) => [row.normalizedPhone!, row]),
    );

    for (const row of source) {
      const existing =
        byKey.get(row.externalKey) ??
        byName.get(row.normalizedName) ??
        (row.normalizedPhone ? byPhone.get(row.normalizedPhone) : undefined);
      if (!existing) {
        const created = tx
          .insert(dealers)
          .values({ ...row, sourceImportedAt: importedAt })
          .returning()
          .get();
        byKey.set(created.externalKey, created);
        byName.set(created.normalizedName, created);
        if (created.normalizedPhone) byPhone.set(created.normalizedPhone, created);
        counts.created += 1;
      } else if (existing.source?.startsWith("TAMYZ dealer research")) {
        counts.unchanged += 1;
      } else if (sourceChanged(existing, row)) {
        tx.update(dealers)
          .set({ ...row, sourceImportedAt: importedAt, updatedAt: importedAt })
          .where(eq(dealers.id, existing.id))
          .run();
        counts.updated += 1;
      } else {
        counts.unchanged += 1;
      }
    }
  });

  const withPhone = source.filter((row) => Boolean(row.phone)).length;
  return {
    fileName: path.basename(filePath),
    total: source.length,
    ...counts,
    withPhone,
    withoutPhone: source.length - withPhone,
  };
}
