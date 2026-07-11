import { and, eq } from "drizzle-orm";

import type {
  ClientRegistrationResponseType,
  Owner,
} from "../lib/domain";
import { db, type TamyzDatabase } from "./client";
import {
  activityLog,
  clientRegistrations,
  clients,
  suppliers,
  type ClientRegistration,
} from "./schema";

export type ClientRegistrationErrorCode =
  | "duplicate"
  | "not_found"
  | "invalid_transition"
  | "confirmation_required";

export class ClientRegistrationError extends Error {
  constructor(
    public readonly code: ClientRegistrationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ClientRegistrationError";
  }
}

interface CreateClientRegistrationInput {
  clientId: number;
  supplierId: number;
  actor: Owner;
  requestedCommissionPercent: number;
  requestedRepeatCommissionMonths: number;
  commissionPaymentBusinessDays: number;
  occurredAt?: Date;
}

interface RegistrationMutationInput {
  registrationId: number;
  actor: Owner;
  occurredAt?: Date;
}

interface RecordClientRegistrationResponseInput extends RegistrationMutationInput {
  responseType: ClientRegistrationResponseType;
  supplierResponseText: string;
  confirmedCommissionPercent?: number | null;
  confirmedRepeatCommissionMonths?: number | null;
}

function getRegistrationContext(
  registrationId: number,
  database: TamyzDatabase,
) {
  const registration = database
    .select()
    .from(clientRegistrations)
    .where(eq(clientRegistrations.id, registrationId))
    .get();
  if (!registration) {
    throw new ClientRegistrationError("not_found", "Регистрация клиента не найдена");
  }

  const client = database
    .select()
    .from(clients)
    .where(eq(clients.id, registration.clientId))
    .get();
  const supplier = database
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, registration.supplierId))
    .get();
  if (!client || !supplier) {
    throw new ClientRegistrationError(
      "not_found",
      "Клиент или поставщик регистрации не найден",
    );
  }

  return { registration, client, supplier };
}

function journalRegistrationChange(
  tx: TamyzDatabase,
  context: ReturnType<typeof getRegistrationContext>,
  input: {
    actor: Owner;
    occurredAt: Date;
    actionType:
      | "client_registration_created"
      | "client_registration_requested"
      | "client_registration_response_recorded"
      | "client_introduction_recorded";
    oldStatus: string | null;
    newStatus: string;
    responseText?: string | null;
  },
) {
  tx.insert(activityLog)
    .values({
      occurredAt: input.occurredAt,
      actor: input.actor,
      contactType: "client",
      clientId: context.client.id,
      supplierId: context.supplier.id,
      contactName: `${context.client.name} → ${context.supplier.name}`,
      actionType: input.actionType,
      oldStatus: input.oldStatus,
      newStatus: input.newStatus,
      responseText: input.responseText,
    })
    .run();
}

export function createClientRegistration(
  input: CreateClientRegistrationInput,
  database: TamyzDatabase = db,
): ClientRegistration {
  return database.transaction((tx) => {
    const client = tx.select().from(clients).where(eq(clients.id, input.clientId)).get();
    const supplier = tx
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, input.supplierId))
      .get();
    if (!client || !supplier) {
      throw new ClientRegistrationError("not_found", "Клиент или поставщик не найден");
    }

    const duplicate = tx
      .select({ id: clientRegistrations.id })
      .from(clientRegistrations)
      .where(
        and(
          eq(clientRegistrations.clientId, input.clientId),
          eq(clientRegistrations.supplierId, input.supplierId),
        ),
      )
      .get();
    if (duplicate) {
      throw new ClientRegistrationError(
        "duplicate",
        "Для этой пары клиент + поставщик регистрация уже существует",
      );
    }

    const occurredAt = input.occurredAt ?? new Date();
    const registration = tx
      .insert(clientRegistrations)
      .values({
        clientId: input.clientId,
        supplierId: input.supplierId,
        requestedCommissionPercent: input.requestedCommissionPercent,
        requestedRepeatCommissionMonths: input.requestedRepeatCommissionMonths,
        commissionPaymentBusinessDays: input.commissionPaymentBusinessDays,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      })
      .returning()
      .get();

    journalRegistrationChange(
      tx,
      { registration, client, supplier },
      {
        actor: input.actor,
        occurredAt,
        actionType: "client_registration_created",
        oldStatus: null,
        newStatus: registration.status,
      },
    );
    return registration;
  });
}

export function markClientRegistrationRequestSent(
  input: RegistrationMutationInput,
  database: TamyzDatabase = db,
): ClientRegistration {
  return database.transaction((tx) => {
    const context = getRegistrationContext(input.registrationId, tx);
    if (context.registration.status !== "черновик") {
      throw new ClientRegistrationError(
        "invalid_transition",
        "Отметить отправку можно только для черновика",
      );
    }
    const occurredAt = input.occurredAt ?? new Date();
    const updated = tx
      .update(clientRegistrations)
      .set({
        status: "ожидает подтверждения",
        requestSentAt: occurredAt,
        updatedAt: occurredAt,
      })
      .where(eq(clientRegistrations.id, input.registrationId))
      .returning()
      .get();

    journalRegistrationChange(tx, context, {
      actor: input.actor,
      occurredAt,
      actionType: "client_registration_requested",
      oldStatus: context.registration.status,
      newStatus: updated.status,
    });
    return updated;
  });
}

export function recordClientRegistrationResponse(
  input: RecordClientRegistrationResponseInput,
  database: TamyzDatabase = db,
): ClientRegistration {
  return database.transaction((tx) => {
    const context = getRegistrationContext(input.registrationId, tx);
    if (context.registration.status !== "ожидает подтверждения") {
      throw new ClientRegistrationError(
        "invalid_transition",
        "Ответ можно зафиксировать только для отправленного запроса",
      );
    }

    if (
      (input.responseType === "confirmed" || input.responseType === "counteroffer") &&
      (input.confirmedCommissionPercent == null ||
        input.confirmedRepeatCommissionMonths == null)
    ) {
      throw new ClientRegistrationError(
        "invalid_transition",
        "Укажите комиссию и срок из ответа поставщика",
      );
    }

    const status =
      input.responseType === "confirmed"
        ? "подтверждён"
        : input.responseType === "already_client"
          ? "уже является клиентом поставщика"
          : "условия отклонены";
    const occurredAt = input.occurredAt ?? new Date();
    const updated = tx
      .update(clientRegistrations)
      .set({
        status,
        responseType: input.responseType,
        supplierResponseText: input.supplierResponseText,
        confirmedCommissionPercent:
          input.responseType === "confirmed" || input.responseType === "counteroffer"
            ? input.confirmedCommissionPercent
            : null,
        confirmedRepeatCommissionMonths:
          input.responseType === "confirmed" || input.responseType === "counteroffer"
            ? input.confirmedRepeatCommissionMonths
            : null,
        confirmedAt: input.responseType === "confirmed" ? occurredAt : null,
        updatedAt: occurredAt,
      })
      .where(eq(clientRegistrations.id, input.registrationId))
      .returning()
      .get();

    journalRegistrationChange(tx, context, {
      actor: input.actor,
      occurredAt,
      actionType: "client_registration_response_recorded",
      oldStatus: context.registration.status,
      newStatus: updated.status,
      responseText: input.supplierResponseText,
    });
    return updated;
  });
}

export function introduceClientToSupplier(
  input: RegistrationMutationInput,
  database: TamyzDatabase = db,
): ClientRegistration {
  return database.transaction((tx) => {
    const context = getRegistrationContext(input.registrationId, tx);
    if (context.registration.status !== "подтверждён") {
      throw new ClientRegistrationError(
        "confirmation_required",
        "Сначала нужно получить и зафиксировать подтверждение поставщика",
      );
    }
    const occurredAt = input.occurredAt ?? new Date();
    const updated = tx
      .update(clientRegistrations)
      .set({ status: "стороны познакомлены", introducedAt: occurredAt, updatedAt: occurredAt })
      .where(eq(clientRegistrations.id, input.registrationId))
      .returning()
      .get();

    journalRegistrationChange(tx, context, {
      actor: input.actor,
      occurredAt,
      actionType: "client_introduction_recorded",
      oldStatus: context.registration.status,
      newStatus: updated.status,
    });
    return updated;
  });
}
