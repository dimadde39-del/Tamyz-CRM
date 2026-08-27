import { readFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import { db, type TamyzDatabase } from "../../db/client";
import { dealers, type Dealer, type NewDealer } from "../../db/schema";
import { DEALER_PRIORITIES, type DealerPriority } from "../domain";
import { normalizePhoneNumber } from "../phone";

export const DEFAULT_DEALER_RESEARCH = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "research",
  "dealers",
  "DEALERS_SHYMKENT_MASTER.md",
);

export const DEALER_RESEARCH_SOURCE = "TAMYZ dealer research 2026-08-27";

const EMPTY_VALUE = "—";
const AGGREGATOR_DOMAINS = new Set([
  "2gis.kz",
  "ba.prg.kz",
  "cataloxy-kz.ru",
  "enbek.kz",
  "kase.kz",
  "kompra.kz",
  "optoviki.kz",
  "statsnet.co",
  "yandex.kz",
]);

type ResearchFields = Record<string, string>;

export interface DealerResearchImportReport {
  fileName: string;
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  matchedByDedupe: number;
  withPhone: number;
  withWhatsApp: number;
  withEmail: number;
}

export interface ImportDealerResearchOptions {
  filePath?: string;
  database?: TamyzDatabase;
}

function valueOrNull(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized !== EMPTY_VALUE ? normalized : null;
}

export function normalizeDealerCompanyName(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/\b(?:too|тоо|ип|ao|ао|llp|филиал)\b/gi, "")
    .replace(/[^a-zа-я0-9әіңғүұқөһ]+/gi, "")
    .trim();
}

function normalizeAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9әіңғүұқөһ]+/gi, "")
    .trim() || null;
}

function canonicalDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const host = new URL(value).hostname.toLocaleLowerCase("en").replace(/^www\./, "");
    if ([...AGGREGATOR_DOMAINS].some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      return null;
    }
    return host || null;
  } catch {
    return null;
  }
}

function parsePriority(value: string | undefined): DealerPriority {
  const priority = value?.toUpperCase();
  const match = DEALER_PRIORITIES.find((item) => item === priority);
  if (!match) throw new Error(`Неизвестный приоритет дилера: ${String(value)}`);
  return match;
}

function parseScore(value: string | undefined): number {
  const score = Number.parseInt(value ?? "", 10);
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new Error(`Некорректный dealer score: ${String(value)}`);
  }
  return score;
}

function parseSections(markdown: string): Array<{ name: string; fields: ResearchFields }> {
  const activeMarkdown = markdown.split(/^# Rejected research archive$/m, 1)[0] ?? markdown;
  const heading = /^## (.+)$/gm;
  const matches = [...activeMarkdown.matchAll(heading)];
  const sections: Array<{ name: string; fields: ResearchFields }> = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? activeMarkdown.length;
    const fields: ResearchFields = {};
    for (const line of activeMarkdown.slice(start, end).split(/\r?\n/)) {
      const field = /^- ([^:]+):\s*(.*)$/.exec(line);
      if (field) fields[field[1].trim().toLocaleLowerCase("en")] = field[2].trim();
    }
    if (fields.import?.toLocaleLowerCase("en") === "yes") {
      sections.push({ name: match[1].trim(), fields });
    }
  }
  return sections;
}

function researchDealer(
  section: { name: string; fields: ResearchFields },
  rank: number,
): NewDealer {
  const { name, fields } = section;
  const externalKey = valueOrNull(fields["external key"]);
  if (!externalKey) throw new Error(`Нет External key у дилера ${name}`);
  const phone = valueOrNull(fields.phone);
  const whatsappConfirmed = fields["whatsapp confirmed"]?.toLocaleLowerCase("en") === "true";
  const whatsapp = whatsappConfirmed ? valueOrNull(fields.whatsapp) : null;
  const score = parseScore(fields.score);
  const priority = parsePriority(fields.priority);
  const expectedPriority = score >= 75 ? "A" : score >= 50 ? "B" : score >= 30 ? "C" : null;
  if (priority !== expectedPriority) {
    throw new Error(`Score/Priority не согласованы у ${name}: ${score}/${priority}`);
  }

  return {
    externalKey,
    normalizedName: normalizeDealerCompanyName(name),
    normalizedPhone: normalizePhoneNumber(phone),
    rank,
    name,
    legalName: valueOrNull(fields["legal name"]),
    city: valueOrNull(fields.city) ?? "Шымкент",
    address: valueOrNull(fields.address),
    phone,
    additionalPhones: valueOrNull(fields["additional phones"]),
    whatsapp,
    whatsappNormalized: normalizePhoneNumber(whatsapp),
    whatsappConfirmed,
    email: valueOrNull(fields.email),
    website: valueOrNull(fields.website),
    social: valueOrNull(fields.instagram),
    regions: valueOrNull(fields.regions),
    categories: valueOrNull(fields.categories),
    brands: valueOrNull(fields.brands),
    channels: valueOrNull(fields.channels),
    confidence: valueOrNull(fields.confidence),
    score,
    distributionEvidence: valueOrNull(fields["evidence of distribution"]),
    shymkentEvidence: valueOrNull(fields["shymkent evidence"]),
    warehouseEvidence: valueOrNull(fields["warehouse evidence"]),
    logisticsEvidence: valueOrNull(fields["logistics evidence"]),
    salesTeamEvidence: valueOrNull(fields["sales team evidence"]),
    priority,
    note: [valueOrNull(fields.notes), valueOrNull(fields["other contacts"])]
      .filter((item): item is string => Boolean(item))
      .join("\n\n") || null,
    source: DEALER_RESEARCH_SOURCE,
    sourceUrl: valueOrNull(fields.sources),
    sourceCheckedAt: valueOrNull(fields["last checked"]),
  };
}

export async function readDealerResearch(filePath = DEFAULT_DEALER_RESEARCH): Promise<NewDealer[]> {
  const markdown = await readFile(/* turbopackIgnore: true */ filePath, "utf8");
  const rows = parseSections(markdown)
    .map((section) => ({ section, score: parseScore(section.fields.score) }))
    .sort((left, right) => right.score - left.score || left.section.name.localeCompare(right.section.name, "ru"))
    .map(({ section }, index) => researchDealer(section, index + 1));

  const keys = rows.map((row) => row.externalKey);
  const names = rows.map((row) => row.normalizedName);
  if (new Set(keys).size !== keys.length) throw new Error("В Markdown есть дубли External key дилеров");
  if (new Set(names).size !== names.length) throw new Error("В Markdown есть дубли нормализованных названий дилеров");
  return rows;
}

function sourceChanged(existing: Dealer, incoming: NewDealer): boolean {
  const current = existing as unknown as Record<string, unknown>;
  return Object.entries(incoming).some(([key, value]) => current[key] !== value);
}

function singleRowMap(rows: Dealer[], key: (row: Dealer) => string | null): Map<string, Dealer> {
  const grouped = new Map<string, Dealer[]>();
  for (const row of rows) {
    const value = key(row);
    if (!value) continue;
    grouped.set(value, [...(grouped.get(value) ?? []), row]);
  }
  return new Map(
    [...grouped.entries()]
      .filter(([, matches]) => matches.length === 1)
      .map(([value, matches]) => [value, matches[0]]),
  );
}

export async function importDealerResearch(
  options: ImportDealerResearchOptions = {},
): Promise<DealerResearchImportReport> {
  const database = options.database ?? db;
  const filePath = options.filePath ?? DEFAULT_DEALER_RESEARCH;
  const source = await readDealerResearch(filePath);
  const counts = { created: 0, updated: 0, unchanged: 0, matchedByDedupe: 0 };
  const importedAt = new Date();

  database.transaction((tx) => {
    const existingRows = tx.select().from(dealers).all();
    const byKey = new Map(existingRows.map((row) => [row.externalKey, row]));
    const byName = new Map(existingRows.map((row) => [row.normalizedName, row]));
    const byPhone = singleRowMap(existingRows, (row) => row.normalizedPhone);
    const byDomain = singleRowMap(existingRows, (row) => canonicalDomain(row.website));
    const byLegalName = singleRowMap(existingRows, (row) =>
      row.legalName ? normalizeDealerCompanyName(row.legalName) : null,
    );
    const byAddress = singleRowMap(existingRows, (row) => normalizeAddress(row.address));

    for (const row of source) {
      const direct = byKey.get(row.externalKey) ?? byName.get(row.normalizedName);
      const phoneMatch = row.normalizedPhone ? byPhone.get(row.normalizedPhone) : undefined;
      const domain = canonicalDomain(row.website);
      const domainMatch = domain ? byDomain.get(domain) : undefined;
      const legal = row.legalName ? normalizeDealerCompanyName(row.legalName) : null;
      const legalMatch = legal ? byLegalName.get(legal) : undefined;
      const address = normalizeAddress(row.address);
      const addressMatch = address ? byAddress.get(address) : undefined;
      const corroboratedAddressMatch =
        addressMatch && (addressMatch === phoneMatch || addressMatch === domainMatch || addressMatch === legalMatch)
          ? addressMatch
          : undefined;
      const existing = direct ?? phoneMatch ?? domainMatch ?? legalMatch ?? corroboratedAddressMatch;
      if (!existing) {
        const created = tx
          .insert(dealers)
          .values({ ...row, sourceImportedAt: importedAt })
          .returning()
          .get();
        byKey.set(created.externalKey, created);
        byName.set(created.normalizedName, created);
        if (created.normalizedPhone) byPhone.set(created.normalizedPhone, created);
        const createdDomain = canonicalDomain(created.website);
        if (createdDomain) byDomain.set(createdDomain, created);
        counts.created += 1;
      } else if (sourceChanged(existing, row)) {
        tx.update(dealers)
          .set({ ...row, sourceImportedAt: importedAt, updatedAt: importedAt })
          .where(eq(dealers.id, existing.id))
          .run();
        if (!direct) counts.matchedByDedupe += 1;
        counts.updated += 1;
      } else {
        if (!direct) counts.matchedByDedupe += 1;
        counts.unchanged += 1;
      }
    }
  });

  return {
    fileName: path.basename(filePath),
    total: source.length,
    ...counts,
    withPhone: source.filter((row) => Boolean(row.phone)).length,
    withWhatsApp: source.filter((row) => row.whatsappConfirmed && Boolean(row.whatsapp)).length,
    withEmail: source.filter((row) => Boolean(row.email)).length,
  };
}
