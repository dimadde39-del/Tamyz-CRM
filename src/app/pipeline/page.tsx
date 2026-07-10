import { MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { markSupplierSentAction } from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { Pagination } from "@/components/pagination";
import { PipelineUpdateForm } from "@/components/pipeline-update-form";
import { PriorityBadge, QualificationBadge, StatusBadge } from "@/components/status-badge";
import { PageHeader, Panel } from "@/components/ui";
import { listSuppliers, type SupplierListItem } from "@/db/queries";
import { FIRST_SUPPLIER_MESSAGE, OWNERS } from "@/lib/domain";
import { firstListedValue, formatDate, stringParam } from "@/lib/format";
import { isDueOnOrBeforeToday } from "@/lib/time";

export const metadata: Metadata = { title: "Контактный конвейер" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 8;

function queueReason(supplier: SupplierListItem) {
  if (isDueOnOrBeforeToday(supplier.nextActionAt)) return `Follow-up назначен на ${formatDate(supplier.nextActionAt)}`;
  if (supplier.status === "не начато" && supplier.priority === "высокий") return "Высокий приоритет, контакт ещё не начат";
  if (supplier.status === "не начато") return "Контакт ещё не начат";
  if (supplier.status === "сообщение отправлено") return "Сообщение отправлено, ответа пока нет";
  if (supplier.status === "автоответ") return "Получен автоответ — нужен живой менеджер";
  if (supplier.status === "передали менеджеру") return "Нужно квалифицировать роль менеджера и регион";
  if (supplier.status === "регион свободен") return "Регион свободен — перейти к условиям";
  if (supplier.status === "обсуждение условий") return "Нужно закрыть критические поля квалификации";
  if (supplier.status === "follow-up") return "Запланировано повторное касание";
  return "Нужно определить следующий шаг";
}

function queueScore(supplier: SupplierListItem) {
  if (isDueOnOrBeforeToday(supplier.nextActionAt)) return -1000 + supplier.rank;
  const statusWeight: Record<string, number> = {
    "передали менеджеру": 0,
    "регион свободен": 100,
    "обсуждение условий": 150,
    автоответ: 200,
    "сообщение отправлено": 300,
    "не начато": supplier.priority === "высокий" ? 400 : 600,
    "follow-up": 500,
  };
  return (statusWeight[supplier.status] ?? 900) + supplier.rank;
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PipelinePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const owner = OWNERS.find((item) => item === stringParam(raw.owner));
  const page = Math.max(1, Number.parseInt(stringParam(raw.page) ?? "1", 10) || 1);
  const queue = listSuppliers({ owner })
    .filter((supplier) => !["отказ", "закрыт", "регион закрыт", "квалифицирован"].includes(supplier.status))
    .sort((left, right) => queueScore(left) - queueScore(right));
  const pageItems = queue.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader
        eyebrow="Только ручная отправка"
        title="Контактный конвейер"
        description="Система готовит очередь и текст. Человек проверяет сообщение, открывает WhatsApp и отправляет его самостоятельно."
        actions={
          <form method="get" action="/pipeline" className="flex gap-2">
            <select className="field min-w-44" name="owner" defaultValue={owner ?? ""} aria-label="Ответственный">
              <option value="">Все ответственные</option>
              {OWNERS.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
            <button className="btn" type="submit">Применить</button>
          </form>
        }
      />
      {raw.saved || raw.sent ? (
        <div className="mb-4 rounded border border-[#b8d1c2] bg-[var(--accent-soft)] px-4 py-3 text-[13px] font-medium text-[#1e5b43]" role="status">
          {raw.sent ? "Отправка зафиксирована в журнале." : "Ответ, статус и follow-up сохранены в журнале."}
        </div>
      ) : null}

      <div className="space-y-4">
        {pageItems.map((supplier, index) => (
          <article className="panel overflow-hidden rounded-md" key={supplier.id} data-testid="pipeline-card">
            <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-7 min-w-7 items-center justify-center rounded border border-[var(--line-strong)] bg-[#eceee8] text-[11px] font-bold text-[var(--muted)]">{(page - 1) * PAGE_SIZE + index + 1}</span>
                <div>
                  <Link className="text-[16px] font-[730] text-[var(--ink)] underline decoration-black/20 underline-offset-2" href={`/suppliers/${supplier.id}`}>{supplier.name}</Link>
                  <p className="mt-0.5 text-[12px] text-[var(--muted)]">{supplier.city || "город не найден"} · {supplier.category || "категория не указана"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2"><PriorityBadge priority={supplier.priority} /><StatusBadge status={supplier.status} /><QualificationBadge result={supplier.qualificationResult} /></div>
            </div>

            <div className="grid gap-4 p-4 xl:grid-cols-[250px_minmax(0,1fr)]">
              <div className="space-y-3 text-[12px]">
                <div className="rounded border border-[#bccfdf] bg-[var(--info-soft)] p-3 text-[#315776]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em]">Почему сейчас</p>
                  <p className="mt-1 font-medium">{queueReason(supplier)}</p>
                </div>
                <div><p className="label">WhatsApp</p><p className="font-medium">{firstListedValue(supplier.whatsapp) ?? "не найден"}</p></div>
                <div>
                  <p className="label">Телефон</p>
                  <p className="break-words">{firstListedValue(supplier.phone) ?? "не найден"}</p>
                  {(supplier.phone?.split(/[;\n]/).filter((item) => item.trim()).length ?? 0) > 1 ? (
                    <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                      ещё {(supplier.phone?.split(/[;\n]/).filter((item) => item.trim()).length ?? 1) - 1} в карточке
                    </p>
                  ) : null}
                </div>
                <div><p className="label">Следующее действие</p><p>{supplier.nextAction || "не назначено"}</p><p className="mt-1 text-[var(--muted)]">{formatDate(supplier.nextActionAt)}</p></div>
              </div>
              <div>
                <p className="label">Готовое первое сообщение</p>
                <div className="whitespace-pre-wrap rounded border border-[var(--line)] bg-white p-3 text-[13px] leading-5">{FIRST_SUPPLIER_MESSAGE}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {supplier.whatsappUrl ? <a className="btn btn-primary" href={supplier.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" size={15} /> Открыть WhatsApp</a> : <span className="btn" aria-disabled="true"><MessageCircle aria-hidden="true" size={15} /> WhatsApp не найден</span>}
                  <CopyButton value={FIRST_SUPPLIER_MESSAGE} />
                  {firstListedValue(supplier.phone) ? <a className="btn" href={`tel:${firstListedValue(supplier.phone)}`}><Phone aria-hidden="true" size={15} /> Позвонить</a> : null}
                  <form action={markSupplierSentAction}>
                    <input type="hidden" name="supplierId" value={supplier.id} />
                    <input type="hidden" name="actor" value={supplier.owner} />
                    <input type="hidden" name="returnTo" value="/pipeline" />
                    <button className="btn" type="submit">Отметить отправленным</button>
                  </form>
                </div>
              </div>
            </div>
            <PipelineUpdateForm supplier={supplier} />
          </article>
        ))}
      </div>
      {pageItems.length === 0 ? <Panel className="p-10 text-center text-[var(--muted)]">Очередь по этому фильтру пуста.</Panel> : null}
      <div className="panel mt-4 rounded-md"><Pagination page={page} pageSize={PAGE_SIZE} total={queue.length} searchParams={raw} /></div>
    </>
  );
}
