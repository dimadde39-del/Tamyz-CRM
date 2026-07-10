import { asc, eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { addBasketItemAction, saveClientAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { PriorityBadge, StatusBadge, TriStateBadge } from "@/components/status-badge";
import { PageHeader, Panel } from "@/components/ui";
import { db } from "@/db/client";
import { clientBasketItems, clients } from "@/db/schema";
import { CLIENT_STATUSES, OWNERS, TRI_STATE_VALUES, buildWhatsAppUrl } from "@/lib/domain";
import { firstListedValue, formatDateInput } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const client = db.select().from(clients).where(eq(clients.id, Number(id))).get();
  return { title: client?.name ?? "Клиент" };
}

const triLabels = { unknown: "Неизвестно", yes: "Да", no: "Нет" } as const;

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, flash] = await Promise.all([params, searchParams]);
  const client = db.select().from(clients).where(eq(clients.id, Number(id))).get();
  if (!client) notFound();
  const basket = db.select().from(clientBasketItems).where(eq(clientBasketItems.clientId, client.id)).orderBy(asc(clientBasketItems.id)).all();
  const whatsappUrl = buildWhatsAppUrl(client.whatsapp, client.bestFirstQuestion ?? "Здравствуйте. Можно задать несколько коротких вопросов о вашей текущей корзине профессиональной химии?");

  return (
    <>
      <PageHeader
        eyebrow={`Клиент #${client.rank} · массовый контакт выключен`}
        title={client.name}
        description={[client.category, client.address].filter(Boolean).join(" · ")}
        actions={<Link className="btn" href="/clients"><ArrowLeft aria-hidden="true" size={15} /> К списку</Link>}
      />
      {flash.saved || flash.basket ? <div className="mb-4 rounded border border-[#b8d1c2] bg-[var(--accent-soft)] px-4 py-3 text-[13px] font-medium text-[#1e5b43]" role="status">{flash.basket ? "Позиция добавлена в корзину и записана в журнал." : "Карточка клиента обновлена."}</div> : null}

      <div className="mb-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Контакт">
          <div className="space-y-4 p-4 text-[12px]">
            <div className="flex flex-wrap gap-2"><PriorityBadge priority={client.priority} /><StatusBadge status={client.status} /></div>
            <dl className="grid grid-cols-2 gap-3"><div><dt className="label">WhatsApp</dt><dd>{client.whatsapp || "не найден"}</dd></div><div><dt className="label">Телефон</dt><dd>{client.phone || "не найден"}</dd></div><div><dt className="label">Instagram</dt><dd className="break-all">{client.instagram || "не найден"}</dd></div><div><dt className="label">Ответственный</dt><dd>{client.owner}</dd></div></dl>
            <div className="flex flex-wrap gap-2">
              {whatsappUrl ? <a className="btn" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" size={15} /> Открыть WhatsApp вручную</a> : null}
              {firstListedValue(client.phone) ? <a className="btn" href={`tel:${firstListedValue(client.phone)}`}><Phone aria-hidden="true" size={15} /> Позвонить</a> : null}
              <a className="btn" href={client.twoGisUrl} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" size={15} /> 2GIS</a>
            </div>
            <div className="rounded border border-[var(--line)] bg-white p-3"><p className="label">Лучший первый вопрос из источника</p><p>{client.bestFirstQuestion || "—"}</p></div>
          </div>
        </Panel>
        <Panel title="Рабочие поля">
          <form action={saveClientAction} className="grid gap-3 p-4 sm:grid-cols-2">
            <input type="hidden" name="clientId" value={client.id} />
            <label><span className="label">Кто фиксирует</span><select className="field" name="actor" defaultValue={client.owner}>{OWNERS.map((owner) => <option value={owner} key={owner}>{owner}</option>)}</select></label>
            <label><span className="label">Ответственный</span><select className="field" name="owner" defaultValue={client.owner}>{OWNERS.map((owner) => <option value={owner} key={owner}>{owner}</option>)}</select></label>
            <label><span className="label">Статус</span><select className="field" name="status" defaultValue={client.status}>{CLIENT_STATUSES.map((status) => <option value={status} key={status}>{status}</option>)}</select></label>
            <label><span className="label">Дата следующего контакта</span><input className="field" type="date" name="nextContactAt" defaultValue={formatDateInput(client.nextContactAt)} /></label>
            <label><span className="label">Текущий поставщик</span><input className="field" name="currentSupplier" defaultValue={client.currentSupplier ?? ""} /></label>
            <label><span className="label">Проблема / что не устраивает</span><input className="field" name="problem" defaultValue={client.problem ?? ""} /></label>
            <div className="flex justify-end sm:col-span-2"><SubmitButton>Сохранить клиента</SubmitButton></div>
          </form>
        </Panel>
      </div>

      <Panel title={`Корзина клиента · ${basket.length}`} description="Заполняется только после реального разговора; исходные предположения сюда не переносятся.">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="data-table min-w-[980px]">
            <thead><tr><th>Товар</th><th>Бренд / SKU</th><th>Фасовка</th><th>Канистр</th><th>Л/месяц</th><th>Частота</th><th>Текущая цена</th><th>Доставка</th><th>Готов тестировать</th></tr></thead>
            <tbody>{basket.map((item) => <tr key={item.id}><td className="font-medium">{item.product}</td><td>{item.brand || "—"}<p className="text-[11px] text-[var(--muted)]">{item.sku || "—"}</p></td><td>{item.packaging || "—"}</td><td>{item.canisterQuantity ?? "—"}</td><td>{item.litersPerMonth ?? "—"}</td><td>{item.purchaseFrequency || "—"}</td><td>{item.currentPrice || "—"}</td><td>{item.delivery || "—"}</td><td><TriStateBadge value={item.readyToTestAlternative} /></td></tr>)}{basket.length === 0 ? <tr><td colSpan={9} className="py-8 text-center text-[var(--muted)]">Реальная корзина ещё не собрана.</td></tr> : null}</tbody>
          </table>
        </div>
        <form action={addBasketItemAction} className="grid gap-3 border-t border-[var(--line)] bg-[#f7f7f3] p-4 sm:grid-cols-2 xl:grid-cols-5">
          <input type="hidden" name="clientId" value={client.id} />
          <input type="hidden" name="actor" value={client.owner} />
          <label className="xl:col-span-2"><span className="label">Товар *</span><input className="field" name="product" required placeholder="Например, активная пена" /></label>
          <label><span className="label">Бренд</span><input className="field" name="brand" /></label>
          <label><span className="label">SKU</span><input className="field" name="sku" /></label>
          <label><span className="label">Фасовка</span><input className="field" name="packaging" placeholder="20 л" /></label>
          <label><span className="label">Канистр</span><input className="field" type="number" min="0" name="canisterQuantity" /></label>
          <label><span className="label">Литров в месяц</span><input className="field" type="number" min="0" step="0.1" name="litersPerMonth" /></label>
          <label><span className="label">Частота закупки</span><input className="field" name="purchaseFrequency" /></label>
          <label><span className="label">Текущая цена</span><input className="field" name="currentPrice" /></label>
          <label><span className="label">Доставка</span><input className="field" name="delivery" /></label>
          <label><span className="label">Готов тестировать аналог</span><select className="field" name="readyToTestAlternative" defaultValue="unknown">{TRI_STATE_VALUES.map((state) => <option value={state} key={state}>{triLabels[state]}</option>)}</select></label>
          <div className="flex items-end justify-end xl:col-span-3"><SubmitButton>Добавить позицию</SubmitButton></div>
        </form>
      </Panel>
    </>
  );
}
