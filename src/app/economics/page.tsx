import { asc } from "drizzle-orm";
import { BookOpenCheck, FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  EconomicsWorkbench,
  type EconomicsClientOption,
  type EconomicsRegistrationOption,
  type EconomicsSupplierOption,
  type EconomicsTestBasketOption,
  type SavedScenarioOption,
} from "@/components/economics-workbench";
import { Badge, PageHeader } from "@/components/ui";
import { db } from "@/db/client";
import {
  getEconomicsScenarioById,
  listEconomicsScenarios,
} from "@/db/economics-scenario-service";
import {
  clientBasketItems,
  clientRegistrations,
  clients,
  suppliers,
  testBasketItems,
  testBaskets,
} from "@/db/schema";

export const metadata: Metadata = { title: "Экономика" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function positiveInteger(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export default async function EconomicsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const scenarioId = positiveInteger(raw.scenario);
  const copyId = positiveInteger(raw.copy);
  const requestedClientId = positiveInteger(raw.clientId);
  const requestedTestBasketId = positiveInteger(raw.testBasketId);
  const initialRecord = scenarioId
    ? getEconomicsScenarioById(scenarioId)
    : copyId
      ? getEconomicsScenarioById(copyId)
      : null;

  const clientRows = db.select().from(clients).orderBy(asc(clients.name)).all();
  const basketRows = db
    .select()
    .from(clientBasketItems)
    .orderBy(asc(clientBasketItems.clientId), asc(clientBasketItems.id))
    .all();
  const clientsForWorkbench: EconomicsClientOption[] = clientRows.map((client) => ({
    id: client.id,
    name: client.name,
    owner: client.owner,
    basket: basketRows
      .filter((item) => item.clientId === client.id)
      .map((item) => ({
        id: item.id,
        product: item.product,
        brand: item.brand,
        sku: item.sku,
        packaging: item.packaging,
        canisterQuantity: item.canisterQuantity,
        currentPrice: item.currentPrice,
        delivery: item.delivery,
      })),
  }));

  const suppliersForWorkbench: EconomicsSupplierOption[] = db
    .select()
    .from(suppliers)
    .orderBy(asc(suppliers.name))
    .all()
    .map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      sourceCommission: supplier.sourceCommission,
      sourceRepeatCommission: supplier.sourceRepeatCommission,
      sourceMoq: supplier.sourceMoq,
      sourceDelivery: supplier.sourceDelivery,
      qualifiedMoq: supplier.qualifiedMoq,
    }));

  const registrationsForWorkbench: EconomicsRegistrationOption[] = db
    .select()
    .from(clientRegistrations)
    .orderBy(asc(clientRegistrations.id))
    .all()
    .map((registration) => ({
      id: registration.id,
      clientId: registration.clientId,
      supplierId: registration.supplierId,
      status: registration.status,
      requestedCommissionPercent: String(registration.requestedCommissionPercent),
      confirmedCommissionPercent:
        registration.confirmedCommissionPercent === null
          ? null
          : String(registration.confirmedCommissionPercent),
      requestedRepeatCommissionMonths: registration.requestedRepeatCommissionMonths,
      confirmedRepeatCommissionMonths: registration.confirmedRepeatCommissionMonths,
      commissionPaymentBusinessDays: registration.commissionPaymentBusinessDays,
      supplierResponseText: registration.supplierResponseText,
    }));

  const testItems = db
    .select()
    .from(testBasketItems)
    .orderBy(asc(testBasketItems.testBasketId), asc(testBasketItems.sortOrder))
    .all();
  const testBasketsForWorkbench: EconomicsTestBasketOption[] = db
    .select()
    .from(testBaskets)
    .orderBy(asc(testBaskets.id))
    .all()
    .map((basket) => ({
      id: basket.id,
      supplierId: basket.supplierId,
      name: basket.name,
      // Legacy test-basket totals are whole KZT; the engine receives tiyn.
      dealerAmountMinor: basket.dealerAmount * 100,
      clientAmountMinor: basket.rrpAmount * 100,
      itemNames: testItems
        .filter((item) => item.testBasketId === basket.id)
        .map((item) => [item.sku, item.product].filter(Boolean).join(" · ")),
    }));

  const savedScenarios: SavedScenarioOption[] = listEconomicsScenarios().map((record) => ({
    id: record.scenario.id,
    updatedAt: record.scenario.updatedAt.toISOString(),
    snapshot: record.snapshot,
    result: record.result,
  }));

  const invalidRequestedScenario = (scenarioId || copyId) && !initialRecord;

  return (
    <>
      <PageHeader
        eyebrow="TAMYZ Economics Engine · KZT · без налогов"
        title="Экономика"
        description="Детерминированный расчёт заказа, вознаграждения и концентрата. Сценарии 3/6/12 месяцев не являются прогнозом или гарантией."
        actions={(
          <>
            <Link className="btn" href="/test-baskets"><FlaskConical aria-hidden="true" size={15} /> Тестовые корзины</Link>
            <Link className="btn" href="/activities"><BookOpenCheck aria-hidden="true" size={15} /> Журнал</Link>
          </>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded border border-[#bccfdf] bg-[var(--info-soft)] px-4 py-3 text-[12px] text-[#315776]" role="note">
        <Badge tone="info">Точное ядро</Badge>
        <span>Деньги хранятся в тиынах, проценты — в basis points. Свободный текст CRM показан только как контекст и не превращается в финансовое условие.</span>
      </div>
      {invalidRequestedScenario ? <div className="mb-4 rounded border border-[#e5bcb6] bg-[var(--danger-soft)] px-4 py-3 text-[13px] text-[#8f382f]" role="alert">Запрошенный сценарий не найден. Открыт новый расчёт.</div> : null}

      <EconomicsWorkbench
        key={copyId && initialRecord ? `copy:${copyId}` : scenarioId && initialRecord ? `scenario:${scenarioId}` : requestedTestBasketId ? `test:${requestedTestBasketId}:${requestedClientId ?? "none"}` : requestedClientId ? `client:${requestedClientId}` : "new"}
        clients={clientsForWorkbench}
        suppliers={suppliersForWorkbench}
        registrations={registrationsForWorkbench}
        testBaskets={testBasketsForWorkbench}
        savedScenarios={savedScenarios}
        initialScenario={initialRecord ? { id: initialRecord.scenario.id, snapshot: initialRecord.snapshot } : null}
        copiedFromScenarioId={copyId && initialRecord ? copyId : null}
        initialClientId={initialRecord?.snapshot.client.id ?? requestedClientId}
        initialTestBasketId={initialRecord?.snapshot.sourceTestBasket?.id ?? requestedTestBasketId}
      />
    </>
  );
}
