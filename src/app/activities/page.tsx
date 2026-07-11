import { Download, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader, Panel } from "@/components/ui";
import { listActivities } from "@/db/queries";
import { OWNERS } from "@/lib/domain";
import { compactText, stringParam } from "@/lib/format";
import { formatBusinessDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Журнал действий" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const actionLabels: Record<string, string> = {
  message_sent: "Сообщение отправлено",
  auto_reply_received: "Получен автоответ",
  response_received: "Получен ответ",
  forwarded_to_manager: "Передали менеджеру",
  status_changed: "Статус изменён",
  follow_up_created: "Создан follow-up",
  details_updated: "Данные обновлены",
  client_registration_created: "Создана регистрация клиента",
  client_registration_requested: "Запрошено закрепление клиента",
  client_registration_response_recorded: "Зафиксирован ответ по регистрации",
  client_introduction_recorded: "Стороны познакомлены",
  economics_scenario_created: "Создан сценарий экономики",
  economics_scenario_updated: "Обновлён сценарий экономики",
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const owner = OWNERS.find((item) => item === stringParam(raw.owner));
  const contactType = ["supplier", "client"].find((item) => item === stringParam(raw.type));
  const q = stringParam(raw.q)?.trim().toLocaleLowerCase("ru");
  const page = Math.max(1, Number.parseInt(stringParam(raw.page) ?? "1", 10) || 1);
  const entries = listActivities(5000).filter((entry) => {
    if (owner && entry.actor !== owner) return false;
    if (contactType && entry.contactType !== contactType) return false;
    if (!q) return true;
    return [entry.contactName, entry.responseText, entry.nextAction, entry.oldStatus, entry.newStatus]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase("ru").includes(q));
  });
  const pageItems = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader
        eyebrow="Неизменяемая история операций"
        title="Журнал действий"
        description="Каждое изменение контакта хранит пользователя, переход статуса, ответ и следующий шаг."
        actions={<a className="btn" href="/api/export/activities"><Download aria-hidden="true" size={15} /> Экспорт CSV</a>}
      />
      <Panel className="overflow-hidden">
        <form method="get" action="/activities" className="grid gap-2 p-3 sm:grid-cols-[minmax(240px,1fr)_180px_180px_auto]">
          <label className="relative"><span className="sr-only">Поиск</span><Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={15} /><input className="field pl-9" name="q" type="search" defaultValue={stringParam(raw.q)} placeholder="Контакт, ответ, действие…" /></label>
          <label><span className="sr-only">Пользователь</span><select className="field" name="owner" defaultValue={owner ?? ""}><option value="">Все пользователи</option>{OWNERS.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
          <label><span className="sr-only">Тип контакта</span><select className="field" name="type" defaultValue={contactType ?? ""}><option value="">Все контакты</option><option value="supplier">Поставщики</option><option value="client">Клиенты</option></select></label>
          <button className="btn btn-primary" type="submit">Фильтровать</button>
        </form>
        <div className="scrollbar-thin max-h-[calc(100dvh-245px)] overflow-auto border-t border-[var(--line)]">
          <table className="data-table min-w-[1100px]">
            <thead><tr><th>Дата / пользователь</th><th>Контакт</th><th>Действие</th><th>Переход</th><th>Ответ</th><th>Следующее действие</th></tr></thead>
            <tbody>
              {pageItems.map((entry) => {
                const href = entry.contactType === "supplier" && entry.supplierId ? `/suppliers/${entry.supplierId}` : entry.contactType === "client" && entry.clientId ? `/clients/${entry.clientId}` : null;
                return <tr key={entry.id}><td className="whitespace-nowrap"><p>{formatBusinessDateTime(entry.occurredAt)}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{entry.actor}</p></td><td>{href ? <Link className="font-semibold underline decoration-black/20 underline-offset-2" href={href}>{entry.contactName}</Link> : <span className="font-semibold">{entry.contactName}</span>}<p className="mt-1 text-[11px] text-[var(--muted)]">{entry.contactType === "supplier" ? "поставщик" : "клиент"}</p></td><td>{actionLabels[entry.actionType] ?? entry.actionType}</td><td><div className="flex items-center gap-1.5">{entry.oldStatus ? <StatusBadge status={entry.oldStatus} /> : <span>—</span>}<span>→</span>{entry.newStatus ? <StatusBadge status={entry.newStatus} /> : <span>—</span>}</div></td><td className="max-w-[280px] whitespace-pre-wrap">{compactText(entry.responseText, 150)}</td><td className="max-w-[280px]"><p>{compactText(entry.nextAction, 130)}</p>{entry.nextActionAt ? <p className="mt-1 text-[11px] text-[var(--muted)]">{formatBusinessDateTime(entry.nextActionAt)}</p> : null}</td></tr>;
              })}
              {pageItems.length === 0 ? <tr><td colSpan={6} className="py-12 text-center text-[var(--muted)]">Журнал по этим фильтрам пуст.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={entries.length} searchParams={raw} />
      </Panel>
    </>
  );
}
