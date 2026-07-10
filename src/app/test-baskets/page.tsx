import { asc, eq } from "drizzle-orm";
import { ArrowRight, CircleHelp, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge, MetricCard, PageHeader, Panel } from "@/components/ui";
import { db } from "@/db/client";
import { suppliers, testBasketItems, testBaskets } from "@/db/schema";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Тестовые корзины" };
export const dynamic = "force-dynamic";

const moneyFormatter = new Intl.NumberFormat("ru-KZ", {
  style: "currency",
  currency: "KZT",
  maximumFractionDigits: 0,
});

function formatMoney(amount: number) {
  return moneyFormatter.format(amount);
}

export default function TestBasketsPage() {
  const baskets = db
    .select({ basket: testBaskets, supplierName: suppliers.name })
    .from(testBaskets)
    .innerJoin(suppliers, eq(testBaskets.supplierId, suppliers.id))
    .orderBy(asc(testBaskets.id))
    .all();
  const items = db.select().from(testBasketItems).orderBy(asc(testBasketItems.testBasketId), asc(testBasketItems.sortOrder)).all();
  const itemsByBasket = new Map<number, typeof items>();
  items.forEach((item) => {
    const group = itemsByBasket.get(item.testBasketId) ?? [];
    group.push(item);
    itemsByBasket.set(item.testBasketId, group);
  });
  const totals = baskets.reduce(
    (result, { basket }) => ({
      dealer: result.dealer + basket.dealerAmount,
      rrp: result.rrp + basket.rrpAmount,
      difference: result.difference + basket.priceDifference,
    }),
    { dealer: 0, rrp: 0, difference: 0 },
  );
  const ipandaSupplierId = baskets[0]?.basket.supplierId;

  return (
    <>
      <PageHeader
        eyebrow="Внутренние ценовые сценарии · не клиенты"
        title="Тестовые корзины"
        description="Три сценария HoReCa для проверки экономики IPANDA. Они не добавлены в реальную клиентскую базу и не считаются спросом."
        actions={ipandaSupplierId ? <Link className="btn" href={`/suppliers/${ipandaSupplierId}`}>Открыть IPANDA <ArrowRight aria-hidden="true" size={15} /></Link> : null}
      />

      <div className="mb-4 rounded-md border border-[#e2cc98] bg-[var(--warning-soft)] p-4 text-[13px] text-[#795711]" role="note">
        <div className="flex items-start gap-2.5"><TriangleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={17} /><div><p className="font-[720]">Разница цен не является прибылью TAMYZ.</p><p className="mt-1 leading-5">Нужно подтвердить у IPANDA: выплачивается ли ценовой разрыв или назначается отдельная агентская комиссия.</p></div></div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard label="Дилерская сумма" value={formatMoney(totals.dealer)} detail="по 3 сценариям" />
        <MetricCard label="РРЦ" value={formatMoney(totals.rrp)} detail="ориентир для проверки" tone="info" />
        <MetricCard label="Ценовой разрыв" value={formatMoney(totals.difference)} detail="не признан доходом" tone="warning" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {baskets.map(({ basket, supplierName }) => {
          const basketItems = itemsByBasket.get(basket.id) ?? [];
          return (
            <Panel
              key={basket.id}
              title={basket.name}
              description={`Поставщик: ${supplierName} · ответственный: ${basket.owner}`}
              actions={<Badge tone="warning">Комиссия: не выяснена</Badge>}
            >
              <div className="p-4">
                <dl className="grid grid-cols-3 gap-2 text-[12px]">
                  <div><dt className="label">Дилерская</dt><dd className="mt-1 font-[720]">{formatMoney(basket.dealerAmount)}</dd></div>
                  <div><dt className="label">РРЦ</dt><dd className="mt-1 font-[720]">{formatMoney(basket.rrpAmount)}</dd></div>
                  <div><dt className="label">Разница</dt><dd className="mt-1 font-[720] text-[var(--warning)]">{formatMoney(basket.priceDifference)}</dd></div>
                </dl>
                <div className="mt-4 border-t border-[var(--line)] pt-3">
                  <p className="label">Состав корзины</p>
                  <ol className="mt-2 space-y-1.5 text-[12px]">
                    {basketItems.map((item) => <li className="flex gap-2" key={item.id}><span className="w-4 shrink-0 text-[var(--muted)]">{item.sortOrder}.</span><span>{item.sku ? <span className="font-semibold">{item.sku} </span> : null}{item.product}</span></li>)}
                  </ol>
                </div>
                <div className="mt-4 rounded border border-[var(--line)] bg-[#f7f7f3] p-3 text-[11px] leading-5">
                  <p className="font-[700]">Следующий шаг · {formatDate(basket.nextActionAt)}</p>
                  <p className="mt-1 text-[var(--muted)]">{basket.nextAction}</p>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel title="Что нужно подтвердить" description="До этого ответа цифры остаются ценовой гипотезой, а не экономикой TAMYZ." className="mt-4">
        <div className="flex gap-3 p-4 text-[13px]"><CircleHelp aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--info)]" size={18} /><div><p className="font-[720]">IPANDA: способ выплаты</p><p className="mt-1 leading-5 text-[var(--muted)]">Может ли поставщик выплачивать разницу между дилерской суммой и РРЦ, или агенту назначается отдельная комиссия? Также нужно зафиксировать это письменно для повторных заказов.</p></div></div>
      </Panel>
    </>
  );
}
