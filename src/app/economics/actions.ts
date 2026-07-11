"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  EconomicsScenarioError,
  saveEconomicsScenario,
} from "@/db/economics-scenario-service";
import { OWNERS } from "@/lib/domain";

const safeNonNegativeInteger = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const optionalPositiveId = z.number().int().positive().nullable().optional();

const scenarioLineSchema = z.object({
  key: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(300),
  quantityMilli: safeNonNegativeInteger,
  dealerUnitPriceMinor: safeNonNegativeInteger,
  clientUnitPriceMinor: safeNonNegativeInteger,
  sourceClientBasketItemId: optionalPositiveId,
  sourceTestBasketItemId: optionalPositiveId,
  brand: z.string().max(200).nullable().optional(),
  sku: z.string().max(200).nullable().optional(),
  packaging: z.string().max(200).nullable().optional(),
});

const savePayloadSchema = z.object({
  scenarioId: optionalPositiveId,
  copiedFromScenarioId: optionalPositiveId,
  actor: z.enum(OWNERS),
  clientId: z.number().int().positive(),
  supplierId: z.number().int().positive(),
  registrationId: optionalPositiveId,
  testBasketId: optionalPositiveId,
  title: z.string().trim().min(1).max(300),
  input: z.object({
    lines: z.array(scenarioLineSchema).min(1).max(100),
    earningMode: z.enum(["referral_commission", "dealer_spread", "fixed_fee"]),
    discountBps: safeNonNegativeInteger.max(10_000),
    commissionBps: safeNonNegativeInteger.max(10_000),
    fixedFeeMinor: safeNonNegativeInteger,
    minimumOrderMinor: safeNonNegativeInteger,
    deliveryMinor: safeNonNegativeInteger,
    deliveryPayer: z.enum(["supplier", "client", "tamyz"]),
    otherDirectExpensesMinor: safeNonNegativeInteger,
    repeatOrdersPerMonthMilli: safeNonNegativeInteger,
    repeatCommissionMonths: safeNonNegativeInteger.max(1_200),
    commissionPaymentBusinessDays: safeNonNegativeInteger.max(3_650),
    termsStatus: z.enum(["draft", "confirmed"]),
  }),
});

export type EconomicsSavePayload = z.infer<typeof savePayloadSchema>;

export type EconomicsSaveActionState =
  | { ok: true; scenarioId: number; message: string }
  | { ok: false; message: string };

export async function saveEconomicsScenarioAction(
  rawPayload: EconomicsSavePayload,
): Promise<EconomicsSaveActionState> {
  const parsed = savePayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Проверьте исходные данные сценария.",
    };
  }

  try {
    const saved = saveEconomicsScenario(parsed.data);
    revalidatePath("/economics");
    revalidatePath(`/clients/${parsed.data.clientId}`);
    revalidatePath("/activities");
    return {
      ok: true,
      scenarioId: saved.scenario.id,
      message: parsed.data.scenarioId
        ? "Snapshot сценария обновлён и записан в журнал."
        : "Snapshot сценария сохранён и записан в журнал.",
    };
  } catch (error) {
    if (error instanceof EconomicsScenarioError || error instanceof RangeError) {
      return { ok: false, message: error.message };
    }
    console.error("Failed to save economics scenario", error);
    return { ok: false, message: "Не удалось сохранить сценарий. Повторите попытку." };
  }
}
