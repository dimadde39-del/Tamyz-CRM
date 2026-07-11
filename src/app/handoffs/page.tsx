import { asc } from "drizzle-orm";
import { Handshake } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader, Panel } from "@/components/ui";
import { db } from "@/db/client";
import { listClientRegistrations } from "@/db/queries";
import { clients, suppliers } from "@/db/schema";
import { CLIENT_REGISTRATION_STATUSES } from "@/lib/domain";
import { stringParam } from "@/lib/format";
import { formatBusinessDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Передачи клиентов" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;
type SearchParams = Record<string, string | string[] | undefined>;

export default async function HandoffsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const clientId = Number(stringParam(raw.clientId)) || undefined;
  const supplierId = Number(stringParam(raw.supplierId)) || undefined;
  const status = CLIENT_REGISTRATION_STATUSES.find(
    (item) => item === stringParam(raw.status),
  );
  const page = Math.max(1, Number.parseInt(stringParam(raw.page) ?? "1", 10) || 1);
  const [clientOptions, supplierOptions] = await Promise.all([
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)).all(),
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).orderBy(asc(suppliers.name)).all(),
  ]);
  const registrations = listClientRegistrations({ clientId, supplierId, status });
  const pageItems = registrations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader
        eyebrow="Письменное закрепление до раскрытия контактов"
        title="Передачи клиентов"
        description="Регистрации клиентов у поставщиков, ответы по защите и ручное знакомство сторон. Автоматической отправки нет."
        actions={<Handshake aria-hidden="true" size={20} />}
      />
      <Panel className="overflow-hidden">
        <form action="/handoffs" method="get" className="grid gap-2 p-3 md:grid-cols-[repeat(3,minmax(190px,1fr))_auto_auto]">
          <label>
            <span className="sr-only">Клиент</span>
            <select className="field" name="clientId" defaultValue={clientId ?? ""}>
              <option value="">Все клиенты</option>
              {clientOptions.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Поставщик</span>
            <select className="field" name="supplierId" defaultValue={supplierId ?? ""}>
              <option value="">Все поставщики</option>
              {supplierOptions.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Статус</span>
            <select className="field" name="status" defaultValue={status ?? ""}>
              <option value="">Все статусы</option>
              {CLIENT_REGISTRATION_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" type="submit">Фильтровать</button>
          <Link className="btn" href="/handoffs">Сбросить</Link>
        </form>
        <div className="scrollbar-thin overflow-x-auto border-t border-[var(--line)]">
          <table className="data-table min-w-[1100px]">
            <thead><tr><th>Клиент</th><th>Поставщик</th><th>Статус</th><th>Запрошено</th><th>Подтверждено</th><th>Даты</th><th aria-label="Действия" /></tr></thead>
            <tbody>
              {pageItems.map(({ registration, clientName, clientBin, supplierName }) => (
                <tr key={registration.id}>
                  <td><Link className="font-semibold underline decoration-black/20 underline-offset-2" href={`/clients/${registration.clientId}`}>{clientName}</Link><p className="mt-1 text-[11px] text-[var(--muted)]">{clientBin ? `БИН ${clientBin}` : `Регистрация #${registration.id}`}</p></td>
                  <td><Link className="font-semibold underline decoration-black/20 underline-offset-2" href={`/suppliers/${registration.supplierId}`}>{supplierName}</Link></td>
                  <td><StatusBadge status={registration.status} /></td>
                  <td>{registration.requestedCommissionPercent}% · {registration.requestedRepeatCommissionMonths} мес.<p className="mt-1 text-[11px] text-[var(--muted)]">выплата: {registration.commissionPaymentBusinessDays} раб. дней</p></td>
                  <td>{registration.confirmedCommissionPercent ?? "—"}% · {registration.confirmedRepeatCommissionMonths ?? "—"} мес.</td>
                  <td className="whitespace-nowrap"><p>запрос: {formatBusinessDateTime(registration.requestSentAt)}</p><p className="mt-1">подтверждение: {formatBusinessDateTime(registration.confirmedAt)}</p><p className="mt-1">знакомство: {formatBusinessDateTime(registration.introducedAt)}</p></td>
                  <td className="text-right"><Link className="btn min-h-8" href={`/clients/${registration.clientId}`}>Открыть</Link></td>
                </tr>
              ))}
              {pageItems.length === 0 ? <tr><td colSpan={7} className="py-12 text-center text-[var(--muted)]">Регистраций по этим фильтрам нет.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={registrations.length} searchParams={raw} />
      </Panel>
    </>
  );
}
