import type { Metadata } from "next";
import Link from "next/link";

import { Pagination } from "@/components/pagination";
import { SupplierFilters } from "@/components/supplier-filters";
import { PageHeader, Panel } from "@/components/ui";
import { WhatsAppLinks } from "@/components/whatsapp-links";
import { PriorityBadge, QualificationBadge, StatusBadge } from "@/components/status-badge";
import { listSuppliers } from "@/db/queries";
import { OWNERS, PRIORITIES, SUPPLIER_STATUSES, type QualificationResult } from "@/lib/domain";
import { compactText, firstListedValue, formatDate, stringParam } from "@/lib/format";

export const metadata: Metadata = { title: "Поставщики" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const status = SUPPLIER_STATUSES.find((item) => item === stringParam(raw.status));
  const priority = PRIORITIES.find((item) => item === stringParam(raw.priority));
  const owner = OWNERS.find((item) => item === stringParam(raw.owner));
  const qualification = ["green", "yellow", "red"].find((item) => item === stringParam(raw.qualification)) as QualificationResult | undefined;
  const page = Math.max(1, Number.parseInt(stringParam(raw.page) ?? "1", 10) || 1);
  const items = listSuppliers({ search: stringParam(raw.q), status, priority, owner }).filter(
    (supplier) => !qualification || supplier.qualificationResult === qualification,
  );
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const values = {
    q: stringParam(raw.q),
    status: stringParam(raw.status),
    priority: stringParam(raw.priority),
    owner: stringParam(raw.owner),
    qualification: stringParam(raw.qualification),
  };

  return (
    <>
      <PageHeader
        eyebrow="61 исходный контакт"
        title="Поставщики"
        description="Операционные статусы и подтверждённые условия отделены от рекламных данных из источника."
        actions={<Link className="btn btn-primary" href="/pipeline">Открыть конвейер</Link>}
      />
      <Panel className="overflow-hidden">
        <SupplierFilters values={values} />
        <div className="scrollbar-thin max-h-[calc(100dvh-245px)] overflow-auto border-t border-[var(--line)]">
          <table className="data-table min-w-[1120px]">
            <thead>
              <tr>
                <th>Поставщик</th>
                <th>Контакт</th>
                <th>Приоритет</th>
                <th>Ответственный</th>
                <th>Статус</th>
                <th>Итог</th>
                <th>Следующее действие</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((supplier) => (
                <tr key={supplier.id}>
                  <td className="max-w-[280px]">
                    <Link className="font-[700] text-[var(--ink)] underline decoration-black/20 underline-offset-2 hover:decoration-black/60" href={`/suppliers/${supplier.id}`}>
                      {supplier.name}
                    </Link>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">#{supplier.rank} · {supplier.city || "город не найден"}, {supplier.country || "—"}</p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">{compactText(supplier.category, 80)}</p>
                  </td>
                  <td className="max-w-[200px]">
                    <p className="font-medium">{firstListedValue(supplier.whatsapp) ?? firstListedValue(supplier.phone) ?? "WhatsApp не найден"}</p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">{compactText(firstListedValue(supplier.phone), 26)}</p>
                    <div className="mt-2 flex flex-wrap gap-1"><WhatsAppLinks phone={supplier.phone} whatsapp={supplier.whatsapp} className="btn min-h-8" /></div>
                  </td>
                  <td><PriorityBadge priority={supplier.priority} /><p className="mt-1 text-[11px] text-[var(--muted)]">confidence {supplier.confidenceScore ?? "—"}</p></td>
                  <td>{supplier.owner}</td>
                  <td><StatusBadge status={supplier.status} /><p className="mt-1 text-[11px] text-[var(--muted)]">{formatDate(supplier.lastContactAt)}</p></td>
                  <td><QualificationBadge result={supplier.qualificationResult} /></td>
                  <td className="max-w-[260px]">
                    <p>{compactText(supplier.nextAction, 88)}</p>
                    <p className="mt-1 text-[11px] font-medium text-[var(--muted)]">{formatDate(supplier.nextActionAt)}</p>
                  </td>
                  <td className="text-right">
                    <Link className="btn min-h-8" href={`/suppliers/${supplier.id}`}>Открыть</Link>
                  </td>
                </tr>
              ))}
              {pageItems.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-[var(--muted)]">По этим фильтрам поставщиков нет.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={items.length} searchParams={raw} />
      </Panel>
    </>
  );
}
