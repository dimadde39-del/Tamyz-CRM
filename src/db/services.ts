import { eq } from "drizzle-orm";

import type { ActivityType, DealerStatus, Owner } from "../lib/domain";
import { db, type TamyzDatabase } from "./client";
import { activityLog, dealers, suppliers, type Dealer, type Supplier } from "./schema";

export function updateDealerStatus(
  dealerId: number,
  status: DealerStatus,
  database: TamyzDatabase = db,
): Dealer {
  const updated = database
    .update(dealers)
    .set({ status, updatedAt: new Date() })
    .where(eq(dealers.id, dealerId))
    .returning()
    .get();
  if (!updated) throw new Error(`Дилер ${dealerId} не найден`);
  return updated;
}

export type SupplierOperationalPatch = Partial<
  Pick<
    Supplier,
    | "owner"
    | "status"
    | "lastContactAt"
    | "nextActionAt"
    | "originalResponse"
    | "internalComment"
    | "nextAction"
    | "hasShymkentRepresentative"
    | "decisionMaker"
    | "agencyFormatPossible"
    | "noStockPurchaseRequired"
    | "supplierInvoicesClient"
    | "supplierDeliversClient"
    | "commissionFirstOrder"
    | "commissionRepeatOrders"
    | "clientProtectionConfirmed"
    | "clientProtectionMechanism"
    | "clientProtectionTerm"
    | "qualifiedMoq"
    | "samplesAvailable"
    | "samplesComment"
    | "priceReceived"
    | "documentsSdsReceived"
    | "logisticsComment"
  >
>;

export interface UpdateSupplierWithActivityInput {
  supplierId: number;
  actor: Owner;
  actionType?: ActivityType;
  patch: SupplierOperationalPatch;
  responseText?: string | null;
  occurredAt?: Date;
  idempotencyKey?: string;
}

function inferActivityType(
  oldStatus: Supplier["status"],
  nextStatus: Supplier["status"],
  input: UpdateSupplierWithActivityInput,
): ActivityType {
  if (nextStatus === "сообщение отправлено" && oldStatus !== nextStatus) return "message_sent";
  if (nextStatus === "автоответ" && oldStatus !== nextStatus) return "auto_reply_received";
  if (nextStatus === "передали менеджеру" && oldStatus !== nextStatus) return "forwarded_to_manager";
  if (input.patch.nextActionAt !== undefined || input.patch.nextAction !== undefined) return "follow_up_created";
  if (oldStatus !== nextStatus) return "status_changed";
  if (input.responseText !== undefined || input.patch.originalResponse !== undefined) return "response_received";
  return "details_updated";
}

export function updateSupplierWithActivity(
  input: UpdateSupplierWithActivityInput,
  database: TamyzDatabase = db,
): Supplier {
  return database.transaction((tx) => {
    const before = tx.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).get();
    if (!before) throw new Error(`Поставщик ${input.supplierId} не найден`);

    const occurredAt = input.occurredAt ?? new Date();
    const patch: SupplierOperationalPatch & { updatedAt: Date } = {
      ...input.patch,
      updatedAt: occurredAt,
    };
    if (input.responseText !== undefined && input.patch.originalResponse === undefined) {
      patch.originalResponse = input.responseText;
    }

    const updated = tx
      .update(suppliers)
      .set(patch)
      .where(eq(suppliers.id, input.supplierId))
      .returning()
      .get();
    if (!updated) throw new Error("Не удалось обновить поставщика");

    tx.insert(activityLog)
      .values({
        idempotencyKey: input.idempotencyKey,
        occurredAt,
        actor: input.actor,
        contactType: "supplier",
        supplierId: before.id,
        contactName: before.name,
        actionType: input.actionType ?? inferActivityType(before.status, updated.status, input),
        oldStatus: before.status,
        newStatus: updated.status,
        responseText:
          input.responseText !== undefined ? input.responseText : input.patch.originalResponse,
        nextAction: updated.nextAction,
        nextActionAt: updated.nextActionAt,
      })
      .run();

    return updated;
  });
}

export const KDS_EXTERNAL_KEY = "dup-94d945a784d3";
export const KDS_RESPONSE =
  "автоматический ответ о заказах, затем передан контакт «Ерлан Шымкент».";
export const KDS_COMMENT =
  "Вероятно, региональный представитель уже есть, но его роль не подтверждена";
export const KDS_NEXT_ACTION =
  "Написать Ерлану и выяснить, является ли он дилером или отвечает за B2B-продажи КДС в Шымкенте";

export function seedKdsOperationalRecord(database: TamyzDatabase = db): Supplier {
  const existingMarker = database
    .select({ id: activityLog.id })
    .from(activityLog)
    .where(eq(activityLog.idempotencyKey, "seed:kds:forwarded-to-manager"))
    .get();
  const current = database
    .select()
    .from(suppliers)
    .where(eq(suppliers.externalKey, KDS_EXTERNAL_KEY))
    .get();
  if (!current) throw new Error("КДС-Алматы (rank 24) не найден после импорта");
  if (existingMarker) return current;

  return database.transaction((tx) => {
    const now = new Date();
    const messageAt = new Date(now.getTime() - 120_000);
    const replyAt = new Date(now.getTime() - 60_000);
    const updated = tx
      .update(suppliers)
      .set({
        owner: "Димаш",
        status: "передали менеджеру",
        lastContactAt: now,
        originalResponse: KDS_RESPONSE,
        internalComment: KDS_COMMENT,
        nextAction: KDS_NEXT_ACTION,
        nextActionAt: now,
        updatedAt: now,
      })
      .where(eq(suppliers.id, current.id))
      .returning()
      .get();
    if (!updated) throw new Error("Не удалось дополнить запись КДС-Алматы");

    tx.insert(activityLog)
      .values([
        {
          idempotencyKey: "seed:kds:message-sent",
          occurredAt: messageAt,
          actor: "Димаш",
          contactType: "supplier",
          supplierId: current.id,
          contactName: current.name,
          actionType: "message_sent",
          oldStatus: "не начато",
          newStatus: "сообщение отправлено",
        },
        {
          idempotencyKey: "seed:kds:auto-reply",
          occurredAt: replyAt,
          actor: "Димаш",
          contactType: "supplier",
          supplierId: current.id,
          contactName: current.name,
          actionType: "auto_reply_received",
          oldStatus: "сообщение отправлено",
          newStatus: "автоответ",
          responseText: "автоматический ответ о заказах",
        },
        {
          idempotencyKey: "seed:kds:forwarded-to-manager",
          occurredAt: now,
          actor: "Димаш",
          contactType: "supplier",
          supplierId: current.id,
          contactName: current.name,
          actionType: "forwarded_to_manager",
          oldStatus: "автоответ",
          newStatus: "передали менеджеру",
          responseText: KDS_RESPONSE,
          nextAction: KDS_NEXT_ACTION,
          nextActionAt: now,
        },
      ])
      .run();
    return updated;
  });
}
