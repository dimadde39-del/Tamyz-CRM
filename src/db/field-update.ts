import { eq } from "drizzle-orm";

import { db, type TamyzDatabase } from "./client";
import { activityLog, suppliers, testBasketItems, testBaskets } from "./schema";
import { updateSupplierWithActivity } from "./services";

const FIELD_OCCURRED_AT = new Date("2026-07-10T10:00:00+05:00");
const TOMORROW_AT = new Date("2026-07-11T12:00:00.000Z");
const NEXT_WEEK_CALL_AT = new Date("2026-07-13T12:00:00.000Z");

const IPANDA_NEXT_ACTION =
  "Получить условия по HoReCa: агентская схема, закрепление клиента, комиссия и повторные заказы.";
const PROFF_CLEAN_NEXT_ACTION =
  "Провести созвон и выяснить агентские условия: закрепление, комиссия с повторов, прямой счёт и доставка.";
const KDS_NEXT_ACTION =
  "Выяснить условия сотрудничества: агентская схема, закрепление клиента, комиссия с повторов, прямой счёт и доставка.";
const COMMISSION_NEXT_ACTION =
  "Уточнить у IPANDA, выплачивается ли ценовой разрыв или назначается отдельная комиссия.";
const COMMISSION_NOTE =
  "Ценовой разрыв не является прибылью TAMYZ. Завтра выяснить у IPANDA: выплачивается ли он или назначается отдельная комиссия.";

interface FieldSupplierUpdate {
  name: string;
  idempotencyKey: string;
  response: string;
  patch: Parameters<typeof updateSupplierWithActivity>[0]["patch"];
}

const supplierUpdates: FieldSupplierUpdate[] = [
  {
    name: "IPANDA Chemistry Store",
    idempotencyKey: "field:2026-07-10:ipanda-response",
    response: "Интерес подтверждён, направление HoReCa, прайс получен, ждём условия.",
    patch: {
      owner: "Димаш",
      status: "обсуждение условий",
      lastContactAt: FIELD_OCCURRED_AT,
      originalResponse: "Интерес подтверждён, направление HoReCa, прайс получен, ждём условия.",
      internalComment:
        "Интерес подтверждён по направлению HoReCa. Прайс получен; ожидаем условия агентского сотрудничества.",
      priceReceived: "yes",
      nextAction: IPANDA_NEXT_ACTION,
      nextActionAt: TOMORROW_AT,
    },
  },
  {
    name: "Proff Clean Kazakhstan",
    idempotencyKey: "field:2026-07-10:proff-clean-response",
    response: "Заинтересованы, созвон на следующей неделе.",
    patch: {
      owner: "Димаш",
      status: "обсуждение условий",
      lastContactAt: FIELD_OCCURRED_AT,
      originalResponse: "Заинтересованы, созвон на следующей неделе.",
      internalComment: "Заинтересованы; договорились о созвоне на следующей неделе.",
      nextAction: PROFF_CLEAN_NEXT_ACTION,
      nextActionAt: NEXT_WEEK_CALL_AT,
    },
  },
  {
    name: "КДС-Алматы",
    idempotencyKey: "field:2026-07-10:kds-erlan-response",
    response: "Ерлан — дистрибьютор; бумажная продукция производится в Шымкенте. Условия не выяснены.",
    patch: {
      owner: "Димаш",
      status: "передали менеджеру",
      lastContactAt: FIELD_OCCURRED_AT,
      originalResponse:
        "Ерлан — дистрибьютор; бумажная продукция производится в Шымкенте. Условия не выяснены.",
      internalComment:
        "Ерлан — дистрибьютор; бумажная продукция производится в Шымкенте. Нужно выяснить агентскую схему, закрепление и комиссии.",
      hasShymkentRepresentative: "yes",
      nextAction: KDS_NEXT_ACTION,
      nextActionAt: TOMORROW_AT,
    },
  },
];

interface TestBasketSeed {
  externalKey: string;
  name: string;
  dealerAmount: number;
  rrpAmount: number;
  priceDifference: number;
  items: Array<{ product: string; sku?: string }>;
}

const basketSeeds: TestBasketSeed[] = [
  {
    externalKey: "field:2026-07-10:kitchen-dishwasher",
    name: "Кухня с посудомоечной машиной",
    dealerAmount: 41_195,
    rrpAmount: 50_056,
    priceDifference: 8_861,
    items: [
      { sku: "901СК-5", product: "Grill+" },
      { sku: "902SP-5", product: "средство для посудомоечной машины" },
      { sku: "101SP-5", product: "ополаскиватель" },
      { sku: "901MP-5", product: "средство для полов" },
    ],
  },
  {
    externalKey: "field:2026-07-10:cafe-no-machine",
    name: "Небольшое кафе без машины",
    dealerAmount: 30_195,
    rrpAmount: 36_949,
    priceDifference: 6_754,
    items: [
      { product: "Grill+" },
      { product: "средство для полов" },
      { product: "средство для стекла" },
      { product: "универсальное средство для ежедневной уборки" },
    ],
  },
  {
    externalKey: "field:2026-07-10:hotel-cleaning",
    name: "Гостиница/клининг",
    dealerAmount: 39_545,
    rrpAmount: 48_950,
    priceDifference: 9_405,
    items: [
      { product: "кислотное средство для санузла" },
      { product: "средство с дезинфицирующим эффектом" },
      { product: "полы" },
      { product: "стекло" },
      { product: "универсальная уборка" },
    ],
  },
];

function getSupplierByNameOrThrow(name: string, database: TamyzDatabase) {
  const supplier = database.select().from(suppliers).where(eq(suppliers.name, name)).get();
  if (!supplier) throw new Error(`Поставщик «${name}» не найден после импорта`);
  return supplier;
}

function hasActivityMarker(idempotencyKey: string, database: TamyzDatabase): boolean {
  return Boolean(
    database
      .select({ id: activityLog.id })
      .from(activityLog)
      .where(eq(activityLog.idempotencyKey, idempotencyKey))
      .get(),
  );
}

export interface FieldUpdateReport {
  supplierActivitiesCreated: number;
  testBasketsCreated: number;
}

/** Idempotent operational entry from the 10 July field work. */
export function applyJuly10FieldUpdate(database: TamyzDatabase = db): FieldUpdateReport {
  let supplierActivitiesCreated = 0;

  for (const update of supplierUpdates) {
    const supplier = getSupplierByNameOrThrow(update.name, database);
    if (hasActivityMarker(update.idempotencyKey, database)) continue;

    updateSupplierWithActivity(
      {
        supplierId: supplier.id,
        actor: "Димаш",
        actionType: "response_received",
        patch: update.patch,
        responseText: update.response,
        occurredAt: FIELD_OCCURRED_AT,
        idempotencyKey: update.idempotencyKey,
      },
      database,
    );
    supplierActivitiesCreated += 1;
  }

  const ipanda = getSupplierByNameOrThrow("IPANDA Chemistry Store", database);
  let testBasketsCreated = 0;

  database.transaction((tx) => {
    for (const basket of basketSeeds) {
      const existing = tx
        .select({ id: testBaskets.id })
        .from(testBaskets)
        .where(eq(testBaskets.externalKey, basket.externalKey))
        .get();
      if (existing) continue;

      const created = tx
        .insert(testBaskets)
        .values({
          externalKey: basket.externalKey,
          supplierId: ipanda.id,
          owner: "Димаш",
          name: basket.name,
          dealerAmount: basket.dealerAmount,
          rrpAmount: basket.rrpAmount,
          priceDifference: basket.priceDifference,
          commissionStatus: "unknown",
          differenceIsProfit: false,
          nextAction: COMMISSION_NEXT_ACTION,
          nextActionAt: TOMORROW_AT,
          internalNote: COMMISSION_NOTE,
          createdAt: FIELD_OCCURRED_AT,
          updatedAt: FIELD_OCCURRED_AT,
        })
        .returning({ id: testBaskets.id })
        .get();
      if (!created) throw new Error(`Не удалось создать корзину «${basket.name}»`);

      tx.insert(testBasketItems)
        .values(
          basket.items.map((item, index) => ({
            testBasketId: created.id,
            sortOrder: index + 1,
            product: item.product,
            sku: item.sku ?? null,
          })),
        )
        .run();
      testBasketsCreated += 1;
    }

    const activityKey = "field:2026-07-10:ipanda-test-baskets";
    if (!hasActivityMarker(activityKey, tx)) {
      tx.insert(activityLog)
        .values({
          idempotencyKey: activityKey,
          occurredAt: FIELD_OCCURRED_AT,
          actor: "Димаш",
          contactType: "supplier",
          supplierId: ipanda.id,
          contactName: ipanda.name,
          actionType: "details_updated",
          oldStatus: "обсуждение условий",
          newStatus: "обсуждение условий",
          responseText:
            "Созданы 3 тестовые ценовые корзины для HoReCa. Ценовой разрыв не является прибылью TAMYZ.",
          nextAction: COMMISSION_NEXT_ACTION,
          nextActionAt: TOMORROW_AT,
        })
        .run();
    }
  });

  return { supplierActivitiesCreated, testBasketsCreated };
}

