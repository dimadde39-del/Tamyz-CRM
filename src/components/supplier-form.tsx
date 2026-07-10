import type { SupplierListItem } from "@/db/queries";
import { saveSupplierAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { QualificationBadge } from "@/components/status-badge";
import { OWNERS, SUPPLIER_STATUSES, TRI_STATE_VALUES } from "@/lib/domain";
import { formatDateInput } from "@/lib/format";

const triStateLabels = {
  unknown: "Неизвестно",
  yes: "Да",
  no: "Нет",
} as const;

function TriStateField({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: (typeof TRI_STATE_VALUES)[number];
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <select className="field" name={name} defaultValue={value}>
        {TRI_STATE_VALUES.map((state) => (
          <option key={state} value={state}>
            {triStateLabels[state]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SupplierForm({ supplier }: { supplier: SupplierListItem }) {
  return (
    <form action={saveSupplierAction} className="space-y-4">
      <input type="hidden" name="supplierId" value={supplier.id} />
      <input type="hidden" name="returnTo" value={`/suppliers/${supplier.id}`} />

      <section className="panel rounded-md">
        <div className="flex flex-col gap-2 border-b border-[var(--line)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[14px] font-[720]">Текущая операция</h2>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">Ответ, результат разговора и обязательный следующий шаг.</p>
          </div>
          <QualificationBadge result={supplier.qualificationResult} />
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-4">
          <label>
            <span className="label">Кто фиксирует действие</span>
            <select className="field" name="actor" defaultValue={supplier.owner}>
              {OWNERS.map((owner) => (
                <option value={owner} key={owner}>{owner}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Ответственный</span>
            <select className="field" name="owner" defaultValue={supplier.owner}>
              {OWNERS.map((owner) => (
                <option value={owner} key={owner}>{owner}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Статус</span>
            <select className="field" name="status" defaultValue={supplier.status}>
              {SUPPLIER_STATUSES.map((status) => (
                <option value={status} key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Дата follow-up</span>
            <input className="field" type="date" name="nextActionAt" defaultValue={formatDateInput(supplier.nextActionAt)} />
          </label>
          <label className="lg:col-span-2">
            <span className="label">Исходный ответ поставщика</span>
            <textarea className="field min-h-28" name="originalResponse" defaultValue={supplier.originalResponse ?? ""} placeholder="Вставьте ответ без пересказа…" />
          </label>
          <label className="lg:col-span-2">
            <span className="label">Следующее действие</span>
            <textarea className="field min-h-28" name="nextAction" defaultValue={supplier.nextAction ?? ""} placeholder="Конкретный шаг: кому, что выяснить, к какому сроку…" />
          </label>
          <label className="lg:col-span-4">
            <span className="label">Внутренний комментарий</span>
            <textarea className="field min-h-20" name="internalComment" defaultValue={supplier.internalComment ?? ""} />
          </label>
        </div>
      </section>

      <section className="panel rounded-md">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h2 className="text-[14px] font-[720]">Квалификация агентской схемы</h2>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">Неизвестное остаётся жёлтым. Явный стоп-фактор всегда делает итог красным.</p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <TriStateField name="hasShymkentRepresentative" label="Есть представитель в Шымкенте" value={supplier.hasShymkentRepresentative} />
          <label>
            <span className="label">Кто принимает решение</span>
            <input className="field" name="decisionMaker" defaultValue={supplier.decisionMaker ?? ""} />
          </label>
          <TriStateField name="agencyFormatPossible" label="Агентский формат возможен" value={supplier.agencyFormatPossible} />
          <TriStateField name="noStockPurchaseRequired" label="Закупка на склад не требуется" value={supplier.noStockPurchaseRequired} />
          <TriStateField name="supplierInvoicesClient" label="Поставщик выставляет счёт" value={supplier.supplierInvoicesClient} />
          <TriStateField name="supplierDeliversClient" label="Поставщик доставляет клиенту" value={supplier.supplierDeliversClient} />
          <TriStateField name="commissionFirstOrder" label="Комиссия с первого заказа" value={supplier.commissionFirstOrder} />
          <TriStateField name="commissionRepeatOrders" label="Комиссия с повторов" value={supplier.commissionRepeatOrders} />
          <TriStateField name="clientProtectionConfirmed" label="Защита клиента подтверждена" value={supplier.clientProtectionConfirmed} />
          <label>
            <span className="label">Механизм закрепления</span>
            <input className="field" name="clientProtectionMechanism" defaultValue={supplier.clientProtectionMechanism ?? ""} placeholder="Регистрация лида / договор…" />
          </label>
          <label>
            <span className="label">Срок защиты клиента</span>
            <input className="field" name="clientProtectionTerm" defaultValue={supplier.clientProtectionTerm ?? ""} placeholder="Например, 12 месяцев" />
          </label>
          <label>
            <span className="label">MOQ</span>
            <input className="field" name="qualifiedMoq" defaultValue={supplier.qualifiedMoq ?? ""} />
          </label>
          <TriStateField name="samplesAvailable" label="Образцы" value={supplier.samplesAvailable} />
          <label>
            <span className="label">Комментарий по образцам</span>
            <input className="field" name="samplesComment" defaultValue={supplier.samplesComment ?? ""} />
          </label>
          <TriStateField name="priceReceived" label="Прайс получен" value={supplier.priceReceived} />
          <TriStateField name="documentsSdsReceived" label="Документы / SDS получены" value={supplier.documentsSdsReceived} />
          <label className="sm:col-span-2 xl:col-span-4">
            <span className="label">Комментарий по логистике</span>
            <textarea className="field min-h-20" name="logisticsComment" defaultValue={supplier.logisticsComment ?? ""} />
          </label>
        </div>
      </section>

      <div className="sticky bottom-3 z-10 flex justify-end">
        <SubmitButton className="btn btn-primary min-w-44 shadow-lg" pendingText="Сохраняю действие…">
          Сохранить и записать в журнал
        </SubmitButton>
      </div>
    </form>
  );
}
