import type { Metadata } from "next";
import Link from "next/link";

import { ClientFilters } from "@/components/client-filters";
import { Pagination } from "@/components/pagination";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { PageHeader, Panel } from "@/components/ui";
import { WhatsAppLinks } from "@/components/whatsapp-links";
import { listClients } from "@/db/queries";
import { OWNERS, PRIORITIES } from "@/lib/domain";
import { compactText, firstListedValue, formatDate, stringParam } from "@/lib/format";

export const metadata: Metadata = { title: "Клиенты" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
type SearchParams = Record<string, string | string[] | undefined>;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const priority = PRIORITIES.find((item) => item === stringParam(raw.priority));
  const owner = OWNERS.find((item) => item === stringParam(raw.owner));
  const category = stringParam(raw.category);
  const page = Math.max(1, Number.parseInt(stringParam(raw.page) ?? "1", 10) || 1);
  const items = listClients({ search: stringParam(raw.q), priority, owner }).filter(
    (client) => !category || client.category === category,
  );
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader
        eyebrow="250 записей · контакт отключён"
        title="Клиенты"
        description="База импортирована для исследования спроса. Массовый контакт не активирован; работа ведётся только из карточки."
      />
      <div className="mb-4 rounded border border-[#e2cc98] bg-[var(--warning-soft)] px-4 py-3 text-[12px] text-[#795711]">
        Клиенты не попадают в контактный конвейер автоматически. Сначала нужны подходящие условия поставщика и ручное решение о звонке.
      </div>
      <Panel className="overflow-hidden">
        <ClientFilters values={{ q: stringParam(raw.q), category, priority: stringParam(raw.priority), owner: stringParam(raw.owner) }} />
        <div className="scrollbar-thin max-h-[calc(100dvh-275px)] overflow-auto border-t border-[var(--line)]">
          <table className="data-table min-w-[1050px]">
            <thead><tr><th>Клиент</th><th>Категория</th><th>Контакт</th><th>Приоритет</th><th>Ответственный</th><th>Статус</th><th>Следующий контакт</th><th aria-label="Действия" /></tr></thead>
            <tbody>
              {pageItems.map((client) => (
                <tr key={client.id}>
                  <td className="max-w-[270px]"><Link className="font-[700] text-[var(--ink)] underline decoration-black/20 underline-offset-2" href={`/clients/${client.id}`}>{client.name}</Link><p className="mt-1 text-[11px] text-[var(--muted)]">#{client.rank} · {compactText(client.address, 75)}</p></td>
                  <td className="max-w-[190px]">{client.category || "—"}</td>
                  <td><p>{firstListedValue(client.whatsapp) ?? firstListedValue(client.phone) ?? "WhatsApp не найден"}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{firstListedValue(client.phone) ?? "—"}</p><div className="mt-2 flex flex-wrap gap-1"><WhatsAppLinks phone={client.phone} whatsapp={client.whatsapp} className="btn min-h-8" /></div></td>
                  <td><PriorityBadge priority={client.priority} /><p className="mt-1 text-[11px] text-[var(--muted)]">confidence {client.confidenceScore ?? "—"}</p></td>
                  <td>{client.owner}</td>
                  <td><StatusBadge status={client.status} /></td>
                  <td>{formatDate(client.nextContactAt)}</td>
                  <td className="text-right"><Link className="btn min-h-8" href={`/clients/${client.id}`}>Открыть</Link></td>
                </tr>
              ))}
              {pageItems.length === 0 ? <tr><td colSpan={8} className="py-12 text-center text-[var(--muted)]">По этим фильтрам клиентов нет.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={items.length} searchParams={raw} />
      </Panel>
    </>
  );
}
