"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db/client";
import { updateSupplierWithActivity } from "@/db/services";
import { activityLog, clientBasketItems, clients } from "@/db/schema";
import {
  CLIENT_STATUSES,
  OWNERS,
  SUPPLIER_STATUSES,
  TRI_STATE_VALUES,
} from "@/lib/domain";

const emptyToNull = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

function dateAtNoonUtc(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function safeReturnTo(value: FormDataEntryValue | null, fallback: string) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value.split("?")[0]
    : fallback;
}

function redirectWithFlag(path: string, flag: "saved" | "sent" | "basket") {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${flag}=1`);
}

const supplierIdSchema = z.coerce.number().int().positive();

export async function markSupplierSentAction(formData: FormData) {
  const supplierId = supplierIdSchema.parse(formData.get("supplierId"));
  const actor = z.enum(OWNERS).parse(formData.get("actor") ?? "Димаш");
  const returnTo = safeReturnTo(formData.get("returnTo"), `/suppliers/${supplierId}`);
  const now = new Date();

  updateSupplierWithActivity({
    supplierId,
    actor,
    actionType: "message_sent",
    occurredAt: now,
    patch: {
      status: "сообщение отправлено",
      lastContactAt: now,
    },
  });

  revalidatePath("/");
  revalidatePath("/pipeline");
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/activities");
  redirectWithFlag(returnTo, "sent");
}

const supplierUpdateSchema = z.object({
  supplierId: supplierIdSchema,
  actor: z.enum(OWNERS),
  owner: z.enum(OWNERS),
  status: z.enum(SUPPLIER_STATUSES),
  hasShymkentRepresentative: z.enum(TRI_STATE_VALUES),
  agencyFormatPossible: z.enum(TRI_STATE_VALUES),
  noStockPurchaseRequired: z.enum(TRI_STATE_VALUES),
  supplierInvoicesClient: z.enum(TRI_STATE_VALUES),
  supplierDeliversClient: z.enum(TRI_STATE_VALUES),
  commissionFirstOrder: z.enum(TRI_STATE_VALUES),
  commissionRepeatOrders: z.enum(TRI_STATE_VALUES),
  clientProtectionConfirmed: z.enum(TRI_STATE_VALUES),
  samplesAvailable: z.enum(TRI_STATE_VALUES),
  priceReceived: z.enum(TRI_STATE_VALUES),
  documentsSdsReceived: z.enum(TRI_STATE_VALUES),
});

export async function saveSupplierAction(formData: FormData) {
  const parsed = supplierUpdateSchema.parse({
    supplierId: formData.get("supplierId"),
    actor: formData.get("actor") ?? "Димаш",
    owner: formData.get("owner") ?? "Димаш",
    status: formData.get("status") ?? "не начато",
    hasShymkentRepresentative: formData.get("hasShymkentRepresentative") ?? "unknown",
    agencyFormatPossible: formData.get("agencyFormatPossible") ?? "unknown",
    noStockPurchaseRequired: formData.get("noStockPurchaseRequired") ?? "unknown",
    supplierInvoicesClient: formData.get("supplierInvoicesClient") ?? "unknown",
    supplierDeliversClient: formData.get("supplierDeliversClient") ?? "unknown",
    commissionFirstOrder: formData.get("commissionFirstOrder") ?? "unknown",
    commissionRepeatOrders: formData.get("commissionRepeatOrders") ?? "unknown",
    clientProtectionConfirmed: formData.get("clientProtectionConfirmed") ?? "unknown",
    samplesAvailable: formData.get("samplesAvailable") ?? "unknown",
    priceReceived: formData.get("priceReceived") ?? "unknown",
    documentsSdsReceived: formData.get("documentsSdsReceived") ?? "unknown",
  });
  const returnTo = safeReturnTo(formData.get("returnTo"), `/suppliers/${parsed.supplierId}`);
  const responseText = emptyToNull(formData.get("originalResponse"));
  const now = new Date();

  updateSupplierWithActivity({
    supplierId: parsed.supplierId,
    actor: parsed.actor,
    responseText,
    occurredAt: now,
    patch: {
      owner: parsed.owner,
      status: parsed.status,
      lastContactAt: responseText || parsed.status !== "не начато" ? now : undefined,
      nextActionAt: dateAtNoonUtc(emptyToNull(formData.get("nextActionAt"))),
      originalResponse: responseText,
      internalComment: emptyToNull(formData.get("internalComment")),
      nextAction: emptyToNull(formData.get("nextAction")),
      hasShymkentRepresentative: parsed.hasShymkentRepresentative,
      decisionMaker: emptyToNull(formData.get("decisionMaker")),
      agencyFormatPossible: parsed.agencyFormatPossible,
      noStockPurchaseRequired: parsed.noStockPurchaseRequired,
      supplierInvoicesClient: parsed.supplierInvoicesClient,
      supplierDeliversClient: parsed.supplierDeliversClient,
      commissionFirstOrder: parsed.commissionFirstOrder,
      commissionRepeatOrders: parsed.commissionRepeatOrders,
      clientProtectionConfirmed: parsed.clientProtectionConfirmed,
      clientProtectionMechanism: emptyToNull(formData.get("clientProtectionMechanism")),
      clientProtectionTerm: emptyToNull(formData.get("clientProtectionTerm")),
      qualifiedMoq: emptyToNull(formData.get("qualifiedMoq")),
      samplesAvailable: parsed.samplesAvailable,
      samplesComment: emptyToNull(formData.get("samplesComment")),
      priceReceived: parsed.priceReceived,
      documentsSdsReceived: parsed.documentsSdsReceived,
      logisticsComment: emptyToNull(formData.get("logisticsComment")),
    },
  });

  revalidatePath("/");
  revalidatePath("/pipeline");
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${parsed.supplierId}`);
  revalidatePath("/activities");
  redirectWithFlag(returnTo, "saved");
}

const clientUpdateSchema = z.object({
  clientId: z.coerce.number().int().positive(),
  actor: z.enum(OWNERS),
  owner: z.enum(OWNERS),
  status: z.enum(CLIENT_STATUSES),
});

export async function saveClientAction(formData: FormData) {
  const parsed = clientUpdateSchema.parse({
    clientId: formData.get("clientId"),
    actor: formData.get("actor") ?? "Ерасыл",
    owner: formData.get("owner") ?? "Ерасыл",
    status: formData.get("status") ?? "не активирован",
  });
  const existing = db.select().from(clients).where(eq(clients.id, parsed.clientId)).get();
  if (!existing) throw new Error("Клиент не найден");
  const now = new Date();
  const nextContactAt = dateAtNoonUtc(emptyToNull(formData.get("nextContactAt")));
  const currentSupplier = emptyToNull(formData.get("currentSupplier"));
  const problem = emptyToNull(formData.get("problem"));

  db.transaction((tx) => {
    tx.update(clients)
      .set({
        owner: parsed.owner,
        status: parsed.status,
        currentSupplier,
        problem,
        nextContactAt,
        updatedAt: now,
      })
      .where(eq(clients.id, parsed.clientId))
      .run();
    tx.insert(activityLog)
      .values({
        occurredAt: now,
        actor: parsed.actor,
        contactType: "client",
        clientId: existing.id,
        contactName: existing.name,
        actionType: nextContactAt ? "follow_up_created" : "details_updated",
        oldStatus: existing.status,
        newStatus: parsed.status,
        nextAction: problem,
        nextActionAt: nextContactAt,
      })
      .run();
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${parsed.clientId}`);
  revalidatePath("/activities");
  redirectWithFlag(`/clients/${parsed.clientId}`, "saved");
}

const basketSchema = z.object({
  clientId: z.coerce.number().int().positive(),
  actor: z.enum(OWNERS),
  product: z.string().trim().min(1).max(300),
  canisterQuantity: z.coerce.number().int().min(0).optional(),
  litersPerMonth: z.coerce.number().min(0).optional(),
  readyToTestAlternative: z.enum(TRI_STATE_VALUES),
});

export async function addBasketItemAction(formData: FormData) {
  const parsed = basketSchema.parse({
    clientId: formData.get("clientId"),
    actor: formData.get("actor") ?? "Ерасыл",
    product: formData.get("product"),
    canisterQuantity: emptyToNull(formData.get("canisterQuantity")) ?? undefined,
    litersPerMonth: emptyToNull(formData.get("litersPerMonth")) ?? undefined,
    readyToTestAlternative: formData.get("readyToTestAlternative") ?? "unknown",
  });
  const client = db.select().from(clients).where(eq(clients.id, parsed.clientId)).get();
  if (!client) throw new Error("Клиент не найден");
  const now = new Date();

  db.transaction((tx) => {
    tx.insert(clientBasketItems)
      .values({
        clientId: parsed.clientId,
        product: parsed.product,
        brand: emptyToNull(formData.get("brand")),
        sku: emptyToNull(formData.get("sku")),
        packaging: emptyToNull(formData.get("packaging")),
        canisterQuantity: parsed.canisterQuantity,
        litersPerMonth: parsed.litersPerMonth,
        purchaseFrequency: emptyToNull(formData.get("purchaseFrequency")),
        currentPrice: emptyToNull(formData.get("currentPrice")),
        delivery: emptyToNull(formData.get("delivery")),
        readyToTestAlternative: parsed.readyToTestAlternative,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    tx.insert(activityLog)
      .values({
        occurredAt: now,
        actor: parsed.actor,
        contactType: "client",
        clientId: client.id,
        contactName: client.name,
        actionType: "details_updated",
        oldStatus: client.status,
        newStatus: client.status,
        responseText: `Добавлена корзина: ${parsed.product}`,
      })
      .run();
  });

  revalidatePath("/");
  revalidatePath(`/clients/${parsed.clientId}`);
  revalidatePath("/activities");
  redirectWithFlag(`/clients/${parsed.clientId}`, "basket");
}

export async function deleteBasketItemAction(formData: FormData) {
  const clientId = z.coerce.number().int().positive().parse(formData.get("clientId"));
  const itemId = z.coerce.number().int().positive().parse(formData.get("itemId"));
  db.delete(clientBasketItems)
    .where(and(eq(clientBasketItems.id, itemId), eq(clientBasketItems.clientId, clientId)))
    .run();
  revalidatePath(`/clients/${clientId}`);
  redirectWithFlag(`/clients/${clientId}`, "saved");
}
