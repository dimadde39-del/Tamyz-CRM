import type { Metadata } from "next";
import Link from "next/link";

import { Pagination } from "@/components/pagination";
import { DealerPriorityBadge, DealerStatusBadge } from "@/components/status-badge";
import { PageHeader, Panel } from "@/components/ui";
import { WhatsAppLinks } from "@/components/whatsapp-links";
import { listDealers } from "@/db/queries";
import { DEALER_PRIORITIES, DEALER_STATUSES } from "@/lib/domain";
import { compactText, stringParam } from "@/lib/format";

import { updateDealerStatusAction } from "./actions";

export const metadata: Metadata = { title: "Дилеры" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
type SearchParams = Record<string, string | string[] | undefined>;

const statusLabels: Record<string, string> = {
  candidate: "кандидат",
  contacted: "связались",
  interested: "заинтересован",
  rejected: "отказ",
};

export default async function DealersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const priority = DEALER_PRIORITIES.find((item) => item === stringParam(raw.priority));
  const status = DEALER_STATUSES.find((item) => item === stringParam(raw.status));
  const page = Math.max(1, Number.parseInt(stringParam(raw.page) ?? "1", 10) || 1);
  const items = listDealers({ search: stringParam(raw.q), priority, status });
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader
        eyebrow={`${items.length} контактов по текущему фильтру`}
        title="Дилеры SCANDIC"
        description="Шымкент · ручной outreach через WhatsApp · данные исследования от 11.08.2026"
      />
      <Panel className="overflow-hidden">
        <form action="/dealers" method="get" className="grid gap-2 p-3 md:grid-cols-[minmax(260px,1.5fr)_180px_190px_auto]">
          <label>
            <span className="sr-only">Поиск дилера</span>
            <input className="field" type="search" name="q" defaultValue={stringParam(raw.q)} placeholder="Название, адрес, телефон…" />
          </label>
          <label>
            <span className="sr-only">Приоритет</span>
            <select className="field" name="priority" defaultValue={priority ?? ""}>
              <option value="">Все приоритеты</option>
              {DEALER_PRIORITIES.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Статус</span>
            <select className="field" name="status" defaultValue={status ?? ""}>
              <option value="">Все статусы</option>
              {DEALER_STATUSES.map((item) => <option value={item} key={item}>{statusLabels[item]}</option>)}
            </select>
          </label>
          <div className="flex gap-2">
            <button className="btn btn-primary grow" type="submit">Найти</button>
            <Link className="btn px-3" href="/dealers" aria-label="Сбросить фильтры">×</Link>
          </div>
        </form>
        <div className="scrollbar-thin max-h-[calc(100dvh-245px)] overflow-auto border-t border-[var(--line)]">
          <table className="data-table min-w-[1060px]">
            <thead>
              <tr>
                <th>Название</th>
                <th>Город</th>
                <th>Телефон</th>
                <th>Приоритет</th>
                <th>Статус</th>
                <th>WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((dealer) => (
                <tr key={dealer.id} data-testid="dealer-row">
                  <td className="max-w-[360px]">
                    <p className="font-[700] text-[var(--ink)]">{dealer.name}</p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">{compactText(dealer.address, 90)}</p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">{compactText(dealer.note, 120)}</p>
                  </td>
                  <td>{dealer.city}</td>
                  <td className="max-w-[230px]">
                    <p>{dealer.phone || "—"}</p>
                    {dealer.additionalPhones ? <p className="mt-1 text-[11px] text-[var(--muted)]">Доп.: {dealer.additionalPhones}</p> : null}
                  </td>
                  <td><DealerPriorityBadge priority={dealer.priority} /></td>
                  <td>
                    <div className="mb-2"><DealerStatusBadge status={dealer.status} /></div>
                    <form action={updateDealerStatusAction} className="flex gap-1">
                      <input type="hidden" name="dealerId" value={dealer.id} />
                      <select className="field min-h-8 py-1 text-[12px]" name="status" defaultValue={dealer.status} aria-label={`Статус ${dealer.name}`}>
                        {DEALER_STATUSES.map((item) => <option value={item} key={item}>{statusLabels[item]}</option>)}
                      </select>
                      <button className="btn min-h-8 px-2" type="submit">OK</button>
                    </form>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <WhatsAppLinks phone={dealer.whatsapp ? null : dealer.phone} whatsapp={dealer.whatsapp} className="btn btn-primary min-h-8" label="Написать" />
                    </div>
                    {!dealer.phone && !dealer.whatsapp ? <span className="text-[11px] text-[var(--muted)]">номер не найден</span> : null}
                  </td>
                </tr>
              ))}
              {pageItems.length === 0 ? <tr><td colSpan={6} className="py-12 text-center text-[var(--muted)]">По этим фильтрам дилеров нет.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={items.length} searchParams={raw} />
      </Panel>
    </>
  );
}
