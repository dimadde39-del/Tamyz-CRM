import { desc, eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { markSupplierSentAction } from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { SupplierForm } from "@/components/supplier-form";
import { PageHeader, Panel } from "@/components/ui";
import { PriorityBadge, QualificationBadge, StatusBadge } from "@/components/status-badge";
import { db } from "@/db/client";
import { getSupplierById } from "@/db/queries";
import { activityLog } from "@/db/schema";
import { FIRST_SUPPLIER_MESSAGE } from "@/lib/domain";
import { firstListedValue, formatDate } from "@/lib/format";
import { formatBusinessDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supplier = getSupplierById(Number(id));
  return { title: supplier?.name ?? "Поставщик" };
}

export default async function SupplierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, flash] = await Promise.all([params, searchParams]);
  const supplier = getSupplierById(Number(id));
  if (!supplier) notFound();
  const activities = db
    .select()
    .from(activityLog)
    .where(eq(activityLog.supplierId, supplier.id))
    .orderBy(desc(activityLog.occurredAt))
    .limit(20)
    .all();
  const sourceLinks = supplier.sourceUrl?.split(";").map((item) => item.trim()).filter(Boolean) ?? [];

  return (
    <>
      <PageHeader
        eyebrow={`Поставщик #${supplier.rank}`}
        title={supplier.name}
        description={[supplier.category, supplier.city, supplier.country].filter(Boolean).join(" · ")}
        actions={<Link className="btn" href="/suppliers"><ArrowLeft aria-hidden="true" size={15} /> К списку</Link>}
      />
      {flash.saved || flash.sent ? (
        <div className="mb-4 rounded border border-[#b8d1c2] bg-[var(--accent-soft)] px-4 py-3 text-[13px] font-medium text-[#1e5b43]" role="status">
          {flash.sent ? "Сообщение отмечено отправленным; событие записано в журнал." : "Изменения и действие записаны в журнал."}
        </div>
      ) : null}

      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <Panel title="Контакт и первое сообщение">
          <div className="grid gap-4 p-4 lg:grid-cols-[230px_minmax(0,1fr)]">
            <dl className="space-y-3 text-[12px]">
              <div><dt className="label">WhatsApp</dt><dd className="font-medium">{firstListedValue(supplier.whatsapp) ?? "не найден"}</dd></div>
              <div><dt className="label">Телефон</dt><dd className="break-words">{supplier.phone ?? "не найден"}</dd></div>
              <div><dt className="label">Email</dt><dd className="break-words">{supplier.email ?? "не найден"}</dd></div>
              <div><dt className="label">Сайт</dt><dd className="break-all">{supplier.website ? <a className="underline" href={supplier.website} target="_blank" rel="noreferrer">{supplier.website}</a> : "не найден"}</dd></div>
            </dl>
            <div>
              <p className="label">Шаблон</p>
              <div className="whitespace-pre-wrap rounded border border-[var(--line)] bg-white p-3 text-[13px] leading-5">{FIRST_SUPPLIER_MESSAGE}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {supplier.whatsappUrl ? (
                  <a className="btn btn-primary" href={supplier.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" size={15} /> Открыть WhatsApp</a>
                ) : (
                  <span className="btn" aria-disabled="true"><MessageCircle aria-hidden="true" size={15} /> WhatsApp недоступен</span>
                )}
                <CopyButton value={FIRST_SUPPLIER_MESSAGE} label="Копировать текст" />
                {firstListedValue(supplier.phone) ? <a className="btn" href={`tel:${firstListedValue(supplier.phone)}`}><Phone aria-hidden="true" size={15} /> Позвонить</a> : null}
                <form action={markSupplierSentAction}>
                  <input type="hidden" name="supplierId" value={supplier.id} />
                  <input type="hidden" name="actor" value={supplier.owner} />
                  <input type="hidden" name="returnTo" value={`/suppliers/${supplier.id}`} />
                  <button className="btn" type="submit">Отметить отправленным</button>
                </form>
              </div>
            </div>
          </div>
        </Panel>
        <Panel title="Состояние записи">
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2"><StatusBadge status={supplier.status} /><PriorityBadge priority={supplier.priority} /><QualificationBadge result={supplier.qualificationResult} /></div>
            <dl className="grid grid-cols-2 gap-3 text-[12px]">
              <div><dt className="label">Ответственный</dt><dd>{supplier.owner}</dd></div>
              <div><dt className="label">Confidence</dt><dd>{supplier.confidenceScore ?? "—"}/5</dd></div>
              <div><dt className="label">Последний контакт</dt><dd>{formatDate(supplier.lastContactAt)}</dd></div>
              <div><dt className="label">Follow-up</dt><dd>{formatDate(supplier.nextActionAt)}</dd></div>
            </dl>
            {supplier.needsManualReview ? <p className="rounded border border-[#e2cc98] bg-[var(--warning-soft)] p-3 text-[12px] text-[#795711]">Ручная проверка источника: {supplier.manualReviewReason || "причина не указана"}</p> : null}
          </div>
        </Panel>
      </div>

      <SupplierForm supplier={supplier} />

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Журнал этого поставщика">
          <div className="divide-y divide-[var(--line)]">
            {activities.map((entry) => (
              <div className="grid gap-1 px-4 py-3 text-[12px] sm:grid-cols-[145px_1fr]" key={entry.id}>
                <div className="text-[var(--muted)]"><p>{formatBusinessDateTime(entry.occurredAt)}</p><p>{entry.actor}</p></div>
                <div><p className="font-semibold">{entry.oldStatus || "—"} → {entry.newStatus || "—"}</p>{entry.responseText ? <p className="mt-1 whitespace-pre-wrap">{entry.responseText}</p> : null}{entry.nextAction ? <p className="mt-1 text-[var(--muted)]">Далее: {entry.nextAction}</p> : null}</div>
              </div>
            ))}
            {activities.length === 0 ? <p className="p-4 text-[12px] text-[var(--muted)]">Действий пока нет.</p> : null}
          </div>
        </Panel>
        <Panel title="Данные источника" description="Не считаются подтверждёнными условиями.">
          <div className="space-y-4 p-4 text-[12px]">
            <div><p className="label">Обоснование приоритета</p><p>{supplier.priorityReason || "—"}</p></div>
            <div><p className="label">Доставка из источника</p><p className="max-h-28 overflow-auto whitespace-pre-wrap">{supplier.sourceDelivery || "—"}</p></div>
            <div><p className="label">Цены / MOQ из источника</p><p className="max-h-28 overflow-auto whitespace-pre-wrap">{supplier.sourceMoq || "—"}</p></div>
            <div><p className="label">Source URL</p><ul className="space-y-1">{sourceLinks.map((url) => <li key={url}><a className="inline-flex items-center gap-1 break-all text-[var(--info)] underline" href={url} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" size={12} />{url}</a></li>)}</ul></div>
          </div>
        </Panel>
      </div>
    </>
  );
}
