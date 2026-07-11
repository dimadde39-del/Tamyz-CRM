import { and, desc, eq } from "drizzle-orm";

import {
  ECONOMICS_ENGINE_VERSION,
  calculateEconomics,
  formatMoneyMinor,
  parsePercentToBps,
  type EconomicsScenarioInput,
  type EconomicsScenarioResult,
  type OrderLineInput,
  type TermsStatus,
} from "../lib/economics-engine";
import type { Owner } from "../lib/domain";
import { db, type TamyzDatabase } from "./client";
import {
  activityLog,
  clientBasketItems,
  clientRegistrations,
  clients,
  economicsScenarios,
  suppliers,
  testBaskets,
  testBasketItems,
  type EconomicsScenario,
} from "./schema";

export const ECONOMICS_SNAPSHOT_VERSION = 1;

export interface EconomicsSnapshotLine extends OrderLineInput {
  sourceClientBasketItemId?: number | null;
  sourceTestBasketItemId?: number | null;
  brand?: string | null;
  sku?: string | null;
  packaging?: string | null;
}

export interface EconomicsRegistrationSnapshot {
  id: number;
  status: string;
  requestedCommissionBps: number;
  confirmedCommissionBps: number | null;
  requestedRepeatCommissionMonths: number;
  confirmedRepeatCommissionMonths: number | null;
  commissionPaymentBusinessDays: number;
  supplierResponseText: string | null;
}

export interface SavedEconomicsSnapshot {
  snapshotVersion: typeof ECONOMICS_SNAPSHOT_VERSION;
  engineVersion: typeof ECONOMICS_ENGINE_VERSION;
  title: string;
  termsStatus: TermsStatus;
  client: { id: number; name: string };
  supplier: { id: number; name: string };
  registration: EconomicsRegistrationSnapshot | null;
  sourceTestBasket: { id: number; name: string } | null;
  copiedFromScenarioId: number | null;
  input: Omit<EconomicsScenarioInput, "lines"> & { lines: EconomicsSnapshotLine[] };
  savedAt: string;
}

export interface SaveEconomicsScenarioInput {
  scenarioId?: number | null;
  copiedFromScenarioId?: number | null;
  actor: Owner;
  clientId: number;
  supplierId: number;
  registrationId?: number | null;
  testBasketId?: number | null;
  title: string;
  input: Omit<EconomicsScenarioInput, "lines"> & { lines: EconomicsSnapshotLine[] };
  occurredAt?: Date;
}

export interface EconomicsScenarioRecord {
  scenario: EconomicsScenario;
  snapshot: SavedEconomicsSnapshot;
  result: EconomicsScenarioResult;
}

export type EconomicsScenarioErrorCode =
  | "not_found"
  | "invalid_reference"
  | "invalid_snapshot";

export class EconomicsScenarioError extends Error {
  constructor(
    public readonly code: EconomicsScenarioErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EconomicsScenarioError";
  }
}

function legacyPercentToBps(value: number | null): number | null {
  if (value === null) return null;
  return parsePercentToBps(String(value));
}

function registrationSnapshot(
  registration: typeof clientRegistrations.$inferSelect,
): EconomicsRegistrationSnapshot {
  return {
    id: registration.id,
    status: registration.status,
    requestedCommissionBps: legacyPercentToBps(registration.requestedCommissionPercent) ?? 0,
    confirmedCommissionBps: legacyPercentToBps(registration.confirmedCommissionPercent),
    requestedRepeatCommissionMonths: registration.requestedRepeatCommissionMonths,
    confirmedRepeatCommissionMonths: registration.confirmedRepeatCommissionMonths,
    commissionPaymentBusinessDays: registration.commissionPaymentBusinessDays,
    supplierResponseText: registration.supplierResponseText,
  };
}

function termsStatusLabel(status: TermsStatus): string {
  return status === "confirmed" ? "условия подтверждены" : "черновик условий";
}

function earningModeLabel(mode: EconomicsScenarioInput["earningMode"]): string {
  if (mode === "referral_commission") return "комиссия поставщика";
  if (mode === "dealer_spread") return "дилерская разница";
  return "фиксированная выплата";
}

export function parseEconomicsSnapshot(snapshotJson: string): SavedEconomicsSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(snapshotJson);
  } catch {
    throw new EconomicsScenarioError("invalid_snapshot", "Snapshot сценария повреждён");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("snapshotVersion" in parsed) ||
    parsed.snapshotVersion !== ECONOMICS_SNAPSHOT_VERSION ||
    !("engineVersion" in parsed) ||
    parsed.engineVersion !== ECONOMICS_ENGINE_VERSION ||
    !("input" in parsed)
  ) {
    throw new EconomicsScenarioError(
      "invalid_snapshot",
      "Версия snapshot сценария не поддерживается",
    );
  }
  const snapshot = parsed as SavedEconomicsSnapshot;
  calculateEconomics(snapshot.input);
  return snapshot;
}

function recordFromRow(scenario: EconomicsScenario): EconomicsScenarioRecord {
  const snapshot = parseEconomicsSnapshot(scenario.snapshotJson);
  return { scenario, snapshot, result: calculateEconomics(snapshot.input) };
}

export function getEconomicsScenarioById(
  scenarioId: number,
  database: TamyzDatabase = db,
): EconomicsScenarioRecord | null {
  const scenario = database
    .select()
    .from(economicsScenarios)
    .where(eq(economicsScenarios.id, scenarioId))
    .get();
  return scenario ? recordFromRow(scenario) : null;
}

export function listEconomicsScenarios(
  filters: { clientId?: number; supplierId?: number } = {},
  database: TamyzDatabase = db,
): EconomicsScenarioRecord[] {
  return database
    .select()
    .from(economicsScenarios)
    .orderBy(desc(economicsScenarios.updatedAt))
    .all()
    .filter((scenario) => {
      if (filters.clientId && scenario.clientId !== filters.clientId) return false;
      if (filters.supplierId && scenario.supplierId !== filters.supplierId) return false;
      return true;
    })
    .map(recordFromRow);
}

export function saveEconomicsScenario(
  input: SaveEconomicsScenarioInput,
  database: TamyzDatabase = db,
): EconomicsScenarioRecord {
  const title = input.title.trim();
  if (!title || title.length > 300) {
    throw new EconomicsScenarioError(
      "invalid_snapshot",
      "Название сценария должно содержать от 1 до 300 символов",
    );
  }
  const result = calculateEconomics(input.input);
  const occurredAt = input.occurredAt ?? new Date();

  const scenario = database.transaction((tx) => {
    const existing = input.scenarioId
      ? tx
          .select()
          .from(economicsScenarios)
          .where(eq(economicsScenarios.id, input.scenarioId))
          .get()
      : null;
    if (input.scenarioId && !existing) {
      throw new EconomicsScenarioError("not_found", "Сценарий экономики не найден");
    }
    const existingSnapshot = existing ? parseEconomicsSnapshot(existing.snapshotJson) : null;

    const client = tx.select().from(clients).where(eq(clients.id, input.clientId)).get();
    const supplier = tx
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, input.supplierId))
      .get();
    if (!client || !supplier) {
      throw new EconomicsScenarioError(
        "invalid_reference",
        "Клиент или поставщик сценария не найден",
      );
    }

    const registration = input.registrationId
      ? tx
          .select()
          .from(clientRegistrations)
          .where(
            and(
              eq(clientRegistrations.id, input.registrationId),
              eq(clientRegistrations.clientId, input.clientId),
              eq(clientRegistrations.supplierId, input.supplierId),
            ),
          )
          .get()
      : null;
    if (input.registrationId && !registration) {
      throw new EconomicsScenarioError(
        "invalid_reference",
        "Регистрация не относится к выбранной паре клиент + поставщик",
      );
    }

    const testBasket = input.testBasketId
      ? tx
          .select()
          .from(testBaskets)
          .where(
            and(
              eq(testBaskets.id, input.testBasketId),
              eq(testBaskets.supplierId, input.supplierId),
            ),
          )
          .get()
      : null;
    if (input.testBasketId && !testBasket) {
      throw new EconomicsScenarioError(
        "invalid_reference",
        "Тестовая корзина не относится к выбранному поставщику",
      );
    }

    const priorClientBasketIds = new Set(
      existingSnapshot && existingSnapshot.client.id === client.id
        ? existingSnapshot.input.lines
            .map((line) => line.sourceClientBasketItemId)
            .filter((id): id is number => typeof id === "number")
        : [],
    );
    const priorTestBasketItemIds = new Set(
      existingSnapshot &&
        existingSnapshot.sourceTestBasket &&
        testBasket &&
        existingSnapshot.sourceTestBasket.id === testBasket.id
        ? existingSnapshot.input.lines
            .map((line) => line.sourceTestBasketItemId)
            .filter((id): id is number => typeof id === "number")
        : [],
    );
    const lineKeys = new Set<string>();
    for (const line of input.input.lines) {
      if (lineKeys.has(line.key)) {
        throw new EconomicsScenarioError("invalid_snapshot", "Ключи позиций корзины должны быть уникальными");
      }
      lineKeys.add(line.key);
      if (line.sourceClientBasketItemId) {
        const sourceItem = tx
          .select({ clientId: clientBasketItems.clientId })
          .from(clientBasketItems)
          .where(eq(clientBasketItems.id, line.sourceClientBasketItemId))
          .get();
        if (
          sourceItem?.clientId !== client.id &&
          !priorClientBasketIds.has(line.sourceClientBasketItemId)
        ) {
          throw new EconomicsScenarioError(
            "invalid_reference",
            "Позиция snapshot не относится к корзине выбранного клиента",
          );
        }
      }
      if (line.sourceTestBasketItemId) {
        const sourceItem = tx
          .select({ testBasketId: testBasketItems.testBasketId })
          .from(testBasketItems)
          .where(eq(testBasketItems.id, line.sourceTestBasketItemId))
          .get();
        if (
          sourceItem?.testBasketId !== testBasket?.id &&
          !priorTestBasketItemIds.has(line.sourceTestBasketItemId)
        ) {
          throw new EconomicsScenarioError(
            "invalid_reference",
            "Позиция snapshot не относится к выбранной тестовой корзине",
          );
        }
      }
    }

    const copiedFromScenarioId = existing?.copiedFromScenarioId ?? input.copiedFromScenarioId ?? null;
    if (!existing && copiedFromScenarioId) {
      const source = tx
        .select({ id: economicsScenarios.id })
        .from(economicsScenarios)
        .where(eq(economicsScenarios.id, copiedFromScenarioId))
        .get();
      if (!source) {
        throw new EconomicsScenarioError("invalid_reference", "Исходный сценарий копии не найден");
      }
    }

    const snapshot: SavedEconomicsSnapshot = {
      snapshotVersion: ECONOMICS_SNAPSHOT_VERSION,
      engineVersion: ECONOMICS_ENGINE_VERSION,
      title,
      termsStatus: input.input.termsStatus,
      client:
        existingSnapshot?.client.id === client.id
          ? existingSnapshot.client
          : { id: client.id, name: client.name },
      supplier:
        existingSnapshot?.supplier.id === supplier.id
          ? existingSnapshot.supplier
          : { id: supplier.id, name: supplier.name },
      registration:
        existingSnapshot?.registration &&
        registration &&
        existingSnapshot.registration.id === registration.id
          ? existingSnapshot.registration
          : registration
            ? registrationSnapshot(registration)
            : null,
      sourceTestBasket:
        existingSnapshot?.sourceTestBasket &&
        testBasket &&
        existingSnapshot.sourceTestBasket.id === testBasket.id
          ? existingSnapshot.sourceTestBasket
          : testBasket
            ? { id: testBasket.id, name: testBasket.name }
            : null,
      copiedFromScenarioId,
      input: input.input,
      savedAt: occurredAt.toISOString(),
    };

    const values = {
      clientId: client.id,
      supplierId: supplier.id,
      registrationId: registration?.id ?? null,
      testBasketId: testBasket?.id ?? null,
      copiedFromScenarioId,
      owner: input.actor,
      title,
      termsStatus: input.input.termsStatus,
      earningMode: input.input.earningMode,
      calculationVersion: ECONOMICS_ENGINE_VERSION,
      snapshotJson: JSON.stringify(snapshot),
      updatedAt: occurredAt,
    } as const;

    const saved = existing
      ? tx
          .update(economicsScenarios)
          .set(values)
          .where(eq(economicsScenarios.id, existing.id))
          .returning()
          .get()
      : tx
          .insert(economicsScenarios)
          .values({ ...values, createdAt: occurredAt })
          .returning()
          .get();

    tx.insert(activityLog)
      .values({
        occurredAt,
        actor: input.actor,
        contactType: "client",
        clientId: client.id,
        supplierId: supplier.id,
        contactName: `${client.name} → ${supplier.name}`,
        actionType: existing ? "economics_scenario_updated" : "economics_scenario_created",
        oldStatus: existing ? termsStatusLabel(existing.termsStatus) : null,
        newStatus: termsStatusLabel(input.input.termsStatus),
        responseText: `${title}: доход до налогов ${formatMoneyMinor(result.netIncomeBeforeTaxMinor)}; режим — ${earningModeLabel(input.input.earningMode)}.`,
      })
      .run();

    return saved;
  });

  return recordFromRow(scenario);
}
