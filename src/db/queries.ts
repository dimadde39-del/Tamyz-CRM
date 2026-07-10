import { desc, eq } from "drizzle-orm";

import { buildWhatsAppUrl, getQualificationResult, type Owner, type Priority, type SupplierStatus } from "../lib/domain";
import { db, type TamyzDatabase } from "./client";
import { activityLog, clients, importRuns, suppliers, type Client, type Supplier } from "./schema";

export interface SupplierFilters {
  search?: string;
  status?: SupplierStatus;
  priority?: Priority;
  owner?: Owner;
}

export type SupplierListItem = Supplier & {
  qualificationResult: ReturnType<typeof getQualificationResult>;
  whatsappUrl: string | null;
};

function decorateSupplier(supplier: Supplier): SupplierListItem {
  return {
    ...supplier,
    qualificationResult: getQualificationResult(supplier),
    whatsappUrl: buildWhatsAppUrl(supplier.whatsapp),
  };
}

export function listSuppliers(
  filters: SupplierFilters = {},
  database: TamyzDatabase = db,
): SupplierListItem[] {
  const search = filters.search?.trim().toLocaleLowerCase("ru");

  return database
    .select()
    .from(suppliers)
    .all()
    .filter((supplier) => {
      if (filters.status && supplier.status !== filters.status) return false;
      if (filters.priority && supplier.priority !== filters.priority) return false;
      if (filters.owner && supplier.owner !== filters.owner) return false;
      if (!search) return true;
      return [supplier.name, supplier.category, supplier.city, supplier.country, supplier.email, supplier.phone]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase("ru").includes(search));
    })
    .sort((left, right) => left.rank - right.rank)
    .map(decorateSupplier);
}

export function getSupplierById(
  id: number,
  database: TamyzDatabase = db,
): SupplierListItem | null {
  const supplier = database.select().from(suppliers).where(eq(suppliers.id, id)).get();
  return supplier ? decorateSupplier(supplier) : null;
}

export function getSupplierByExternalKey(
  externalKey: string,
  database: TamyzDatabase = db,
): SupplierListItem | null {
  const supplier = database
    .select()
    .from(suppliers)
    .where(eq(suppliers.externalKey, externalKey))
    .get();
  return supplier ? decorateSupplier(supplier) : null;
}

export interface ClientFilters {
  search?: string;
  priority?: Priority;
  owner?: Owner;
  status?: Client["status"];
}

export function listClients(
  filters: ClientFilters = {},
  database: TamyzDatabase = db,
): Client[] {
  const search = filters.search?.trim().toLocaleLowerCase("ru");
  return database
    .select()
    .from(clients)
    .all()
    .filter((client) => {
      if (filters.priority && client.priority !== filters.priority) return false;
      if (filters.owner && client.owner !== filters.owner) return false;
      if (filters.status && client.status !== filters.status) return false;
      if (!search) return true;
      return [client.name, client.category, client.address, client.phone, client.instagram]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase("ru").includes(search));
    })
    .sort((left, right) => left.rank - right.rank);
}

export function listActivities(limit = 200, database: TamyzDatabase = db) {
  return database
    .select()
    .from(activityLog)
    .orderBy(desc(activityLog.occurredAt))
    .limit(limit)
    .all();
}

export function getLatestImportRun(database: TamyzDatabase = db) {
  return database.select().from(importRuns).orderBy(desc(importRuns.startedAt)).limit(1).get() ?? null;
}
