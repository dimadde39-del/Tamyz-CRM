import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import {
  ACTIVITY_TYPES,
  CLIENT_REGISTRATION_RESPONSE_TYPES,
  CLIENT_REGISTRATION_STATUSES,
  CLIENT_STATUSES,
  DEALER_PRIORITIES,
  DEALER_STATUSES,
  OWNERS,
  PRIORITIES,
  SUPPLIER_STATUSES,
  TRI_STATE_VALUES,
} from "../lib/domain";

const now = () => new Date();

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    externalKey: text("external_key").notNull(),

    rank: integer("rank").notNull(),
    priority: text("priority", { enum: PRIORITIES }).notNull(),
    priorityReason: text("priority_reason"),
    confidenceScore: integer("confidence_score"),
    confidenceReason: text("confidence_reason"),
    contactQuality: text("contact_quality"),
    name: text("name").notNull(),
    category: text("category"),
    country: text("country"),
    city: text("city"),
    website: text("website"),
    whatsapp: text("whatsapp"),
    whatsappNormalized: text("whatsapp_normalized"),
    phone: text("phone"),
    email: text("email"),
    instagram: text("instagram"),
    telegram: text("telegram"),
    vk: text("vk"),
    partnershipProgram: text("partnership_program"),
    partnershipUrl: text("partnership_url"),
    sourceDelivery: text("source_delivery"),
    sourceMoq: text("source_moq"),
    sourceSds: text("source_sds"),
    sourceAgencyScheme: text("source_agency_scheme"),
    sourceClientProtection: text("source_client_protection"),
    sourceCommission: text("source_commission"),
    sourceRepeatCommission: text("source_repeat_commission"),
    potentialMargin: text("potential_margin"),
    weaknesses: text("weaknesses"),
    scrapeDate: text("scrape_date"),
    lastCheckedAt: text("last_checked_at"),
    scrapeMethod: text("scrape_method"),
    needsManualReview: integer("needs_manual_review", { mode: "boolean" }).notNull().default(false),
    manualReviewReason: text("manual_review_reason"),
    autoFoundFields: text("auto_found_fields"),
    sourceUrl: text("source_url"),
    rawData: text("raw_data"),
    sourceImportedAt: integer("source_imported_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(now),

    owner: text("owner", { enum: OWNERS }).notNull().default("Димаш"),
    status: text("status", { enum: SUPPLIER_STATUSES }).notNull().default("не начато"),
    lastContactAt: integer("last_contact_at", { mode: "timestamp_ms" }),
    nextActionAt: integer("next_action_at", { mode: "timestamp_ms" }),
    originalResponse: text("original_response"),
    internalComment: text("internal_comment"),
    nextAction: text("next_action"),

    hasShymkentRepresentative: text("has_shymkent_representative", {
      enum: TRI_STATE_VALUES,
    })
      .notNull()
      .default("unknown"),
    decisionMaker: text("decision_maker"),
    agencyFormatPossible: text("agency_format_possible", { enum: TRI_STATE_VALUES })
      .notNull()
      .default("unknown"),
    noStockPurchaseRequired: text("no_stock_purchase_required", {
      enum: TRI_STATE_VALUES,
    })
      .notNull()
      .default("unknown"),
    supplierInvoicesClient: text("supplier_invoices_client", { enum: TRI_STATE_VALUES })
      .notNull()
      .default("unknown"),
    supplierDeliversClient: text("supplier_delivers_client", { enum: TRI_STATE_VALUES })
      .notNull()
      .default("unknown"),
    commissionFirstOrder: text("commission_first_order", { enum: TRI_STATE_VALUES })
      .notNull()
      .default("unknown"),
    commissionRepeatOrders: text("commission_repeat_orders", { enum: TRI_STATE_VALUES })
      .notNull()
      .default("unknown"),
    clientProtectionConfirmed: text("client_protection_confirmed", {
      enum: TRI_STATE_VALUES,
    })
      .notNull()
      .default("unknown"),
    clientProtectionMechanism: text("client_protection_mechanism"),
    clientProtectionTerm: text("client_protection_term"),
    qualifiedMoq: text("qualified_moq"),
    samplesAvailable: text("samples_available", { enum: TRI_STATE_VALUES })
      .notNull()
      .default("unknown"),
    samplesComment: text("samples_comment"),
    priceReceived: text("price_received", { enum: TRI_STATE_VALUES })
      .notNull()
      .default("unknown"),
    documentsSdsReceived: text("documents_sds_received", { enum: TRI_STATE_VALUES })
      .notNull()
      .default("unknown"),
    logisticsComment: text("logistics_comment"),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("suppliers_external_key_unique").on(table.externalKey),
    index("suppliers_rank_idx").on(table.rank),
    index("suppliers_status_idx").on(table.status),
    index("suppliers_priority_idx").on(table.priority),
    index("suppliers_next_action_idx").on(table.nextActionAt),
  ],
);

export const clients = sqliteTable(
  "clients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    twoGisFirmId: text("two_gis_firm_id").notNull(),

    rank: integer("rank").notNull(),
    priority: text("priority", { enum: PRIORITIES }).notNull(),
    priorityReason: text("priority_reason"),
    confidenceScore: integer("confidence_score"),
    confidenceReason: text("confidence_reason"),
    contactQuality: text("contact_quality"),
    name: text("name").notNull(),
    bin: text("bin"),
    category: text("category"),
    address: text("address"),
    whatsapp: text("whatsapp"),
    whatsappNormalized: text("whatsapp_normalized"),
    phone: text("phone"),
    email: text("email"),
    instagram: text("instagram"),
    telegram: text("telegram"),
    vk: text("vk"),
    website: text("website"),
    twoGisUrl: text("two_gis_url").notNull(),
    sourceActivity: text("source_activity"),
    probableProducts: text("probable_products"),
    sourcePurchaseFrequency: text("source_purchase_frequency"),
    bestFirstQuestion: text("best_first_question"),
    sourceCurrentBasket: text("source_current_basket"),
    sourceCurrentSupplier: text("source_current_supplier"),
    sourcePurchaseVolume: text("source_purchase_volume"),
    sourceDecisionMaker: text("source_decision_maker"),
    scrapeDate: text("scrape_date"),
    lastCheckedAt: text("last_checked_at"),
    scrapeMethod: text("scrape_method"),
    needsManualReview: integer("needs_manual_review", { mode: "boolean" }).notNull().default(false),
    manualReviewReason: text("manual_review_reason"),
    autoFoundFields: text("auto_found_fields"),
    duplicateGroup: text("duplicate_group"),
    sourceUrl: text("source_url"),
    rawData: text("raw_data"),
    sourceImportedAt: integer("source_imported_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(now),

    owner: text("owner", { enum: OWNERS }).notNull().default("Ерасыл"),
    status: text("status", { enum: CLIENT_STATUSES }).notNull().default("не активирован"),
    currentSupplier: text("current_supplier"),
    problem: text("problem"),
    nextContactAt: integer("next_contact_at", { mode: "timestamp_ms" }),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("clients_two_gis_firm_id_unique").on(table.twoGisFirmId),
    index("clients_rank_idx").on(table.rank),
    index("clients_status_idx").on(table.status),
    index("clients_priority_idx").on(table.priority),
  ],
);

export const dealers = sqliteTable(
  "dealers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    externalKey: text("external_key").notNull(),
    normalizedName: text("normalized_name").notNull(),
    normalizedPhone: text("normalized_phone"),
    rank: integer("rank").notNull(),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    city: text("city").notNull().default("Шымкент"),
    address: text("address"),
    phone: text("phone"),
    additionalPhones: text("additional_phones"),
    whatsapp: text("whatsapp"),
    whatsappNormalized: text("whatsapp_normalized"),
    email: text("email"),
    website: text("website"),
    social: text("social"),
    regions: text("regions"),
    categories: text("categories"),
    brands: text("brands"),
    channels: text("channels"),
    confidence: text("confidence"),
    score: integer("score"),
    whatsappConfirmed: integer("whatsapp_confirmed", { mode: "boolean" }).notNull().default(false),
    distributionEvidence: text("distribution_evidence"),
    shymkentEvidence: text("shymkent_evidence"),
    warehouseEvidence: text("warehouse_evidence"),
    logisticsEvidence: text("logistics_evidence"),
    salesTeamEvidence: text("sales_team_evidence"),
    priority: text("priority", { enum: DEALER_PRIORITIES }).notNull(),
    status: text("status", { enum: DEALER_STATUSES }).notNull().default("candidate"),
    note: text("note"),
    source: text("source"),
    sourceUrl: text("source_url"),
    sourceCheckedAt: text("source_checked_at"),
    sourceImportedAt: integer("source_imported_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(now),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("dealers_external_key_unique").on(table.externalKey),
    uniqueIndex("dealers_normalized_name_unique").on(table.normalizedName),
    index("dealers_normalized_phone_idx").on(table.normalizedPhone),
    index("dealers_priority_idx").on(table.priority),
    index("dealers_status_idx").on(table.status),
  ],
);

export const clientBasketItems = sqliteTable(
  "client_basket_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    product: text("product").notNull(),
    brand: text("brand"),
    sku: text("sku"),
    packaging: text("packaging"),
    canisterQuantity: integer("canister_quantity"),
    litersPerMonth: real("liters_per_month"),
    purchaseFrequency: text("purchase_frequency"),
    currentPrice: text("current_price"),
    delivery: text("delivery"),
    readyToTestAlternative: text("ready_to_test_alternative", { enum: TRI_STATE_VALUES })
      .notNull()
      .default("unknown"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [index("client_basket_items_client_idx").on(table.clientId)],
);

/**
 * Internal price scenarios are deliberately separate from client baskets.
 * They help validate a supplier's economics without turning a scenario into a
 * fictional customer or inflating the real-demand metric on the dashboard.
 */
export const testBaskets = sqliteTable(
  "test_baskets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    externalKey: text("external_key").notNull(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    owner: text("owner", { enum: OWNERS }).notNull().default("Димаш"),
    name: text("name").notNull(),
    dealerAmount: integer("dealer_amount").notNull(),
    rrpAmount: integer("rrp_amount").notNull(),
    priceDifference: integer("price_difference").notNull(),
    currency: text("currency").notNull().default("KZT"),
    commissionStatus: text("commission_status", { enum: TRI_STATE_VALUES })
      .notNull()
      .default("unknown"),
    differenceIsProfit: integer("difference_is_profit", { mode: "boolean" })
      .notNull()
      .default(false),
    nextAction: text("next_action"),
    nextActionAt: integer("next_action_at", { mode: "timestamp_ms" }),
    internalNote: text("internal_note"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("test_baskets_external_key_unique").on(table.externalKey),
    index("test_baskets_supplier_idx").on(table.supplierId),
    index("test_baskets_next_action_idx").on(table.nextActionAt),
  ],
);

export const testBasketItems = sqliteTable(
  "test_basket_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    testBasketId: integer("test_basket_id")
      .notNull()
      .references(() => testBaskets.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    product: text("product").notNull(),
    sku: text("sku"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [index("test_basket_items_basket_idx").on(table.testBasketId)],
);

export const clientRegistrations = sqliteTable(
  "client_registrations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    status: text("status", { enum: CLIENT_REGISTRATION_STATUSES })
      .notNull()
      .default("черновик"),
    responseType: text("response_type", { enum: CLIENT_REGISTRATION_RESPONSE_TYPES }),
    requestedCommissionPercent: real("requested_commission_percent").notNull(),
    confirmedCommissionPercent: real("confirmed_commission_percent"),
    requestedRepeatCommissionMonths: integer("requested_repeat_commission_months").notNull(),
    confirmedRepeatCommissionMonths: integer("confirmed_repeat_commission_months"),
    commissionPaymentBusinessDays: integer("commission_payment_business_days").notNull(),
    supplierResponseText: text("supplier_response_text"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    requestSentAt: integer("request_sent_at", { mode: "timestamp_ms" }),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
    introducedAt: integer("introduced_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("client_registrations_client_supplier_unique").on(
      table.clientId,
      table.supplierId,
    ),
    index("client_registrations_status_idx").on(table.status),
    index("client_registrations_supplier_idx").on(table.supplierId),
    index("client_registrations_request_sent_idx").on(table.requestSentAt),
  ],
);

/**
 * Operator-authored economics scenarios. Financial inputs live in the JSON
 * snapshot so later edits to a supplier, registration, or basket cannot
 * rewrite a saved calculation. Entity IDs remain references to the existing
 * CRM records and are never duplicated here.
 */
export const economicsScenarios = sqliteTable(
  "economics_scenarios",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    registrationId: integer("registration_id").references(() => clientRegistrations.id, {
      onDelete: "set null",
    }),
    testBasketId: integer("test_basket_id").references(() => testBaskets.id, {
      onDelete: "set null",
    }),
    copiedFromScenarioId: integer("copied_from_scenario_id"),
    owner: text("owner", { enum: OWNERS }).notNull(),
    title: text("title").notNull(),
    termsStatus: text("terms_status", { enum: ["draft", "confirmed"] as const }).notNull(),
    earningMode: text("earning_mode", {
      enum: ["referral_commission", "dealer_spread", "fixed_fee"] as const,
    }).notNull(),
    calculationVersion: integer("calculation_version").notNull().default(1),
    snapshotJson: text("snapshot_json").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [
    index("economics_scenarios_client_idx").on(table.clientId),
    index("economics_scenarios_supplier_idx").on(table.supplierId),
    index("economics_scenarios_updated_idx").on(table.updatedAt),
  ],
);

export const activityLog = sqliteTable(
  "activity_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    idempotencyKey: text("idempotency_key"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    actor: text("actor", { enum: OWNERS }).notNull(),
    contactType: text("contact_type", { enum: ["supplier", "client"] as const }).notNull(),
    supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    contactName: text("contact_name").notNull(),
    actionType: text("action_type", { enum: ACTIVITY_TYPES }).notNull(),
    oldStatus: text("old_status"),
    newStatus: text("new_status"),
    responseText: text("response_text"),
    nextAction: text("next_action"),
    nextActionAt: integer("next_action_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("activity_log_idempotency_key_unique").on(table.idempotencyKey),
    index("activity_log_supplier_idx").on(table.supplierId),
    index("activity_log_client_idx").on(table.clientId),
    index("activity_log_occurred_at_idx").on(table.occurredAt),
  ],
);

export const importRuns = sqliteTable(
  "import_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fileName: text("file_name").notNull(),
    fileHash: text("file_hash").notNull(),
    status: text("status", { enum: ["running", "completed", "failed"] as const })
      .notNull()
      .default("running"),
    suppliersCreated: integer("suppliers_created").notNull().default(0),
    suppliersUpdated: integer("suppliers_updated").notNull().default(0),
    suppliersUnchanged: integer("suppliers_unchanged").notNull().default(0),
    clientsCreated: integer("clients_created").notNull().default(0),
    clientsUpdated: integer("clients_updated").notNull().default(0),
    clientsUnchanged: integer("clients_unchanged").notNull().default(0),
    errorsJson: text("errors_json"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("import_runs_started_at_idx").on(table.startedAt)],
);

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Dealer = typeof dealers.$inferSelect;
export type NewDealer = typeof dealers.$inferInsert;
export type ActivityLogEntry = typeof activityLog.$inferSelect;
export type ImportRun = typeof importRuns.$inferSelect;
export type TestBasket = typeof testBaskets.$inferSelect;
export type TestBasketItem = typeof testBasketItems.$inferSelect;
export type ClientRegistration = typeof clientRegistrations.$inferSelect;
export type NewClientRegistration = typeof clientRegistrations.$inferInsert;
export type ClientBasketItem = typeof clientBasketItems.$inferSelect;
export type EconomicsScenario = typeof economicsScenarios.$inferSelect;
export type NewEconomicsScenario = typeof economicsScenarios.$inferInsert;
