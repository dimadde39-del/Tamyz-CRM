import type { SupplierListItem } from "@/db/queries";
import { saveSupplierAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { OWNERS, SUPPLIER_STATUSES } from "@/lib/domain";
import { formatDateInput } from "@/lib/format";

export function PipelineUpdateForm({ supplier }: { supplier: SupplierListItem }) {
  return (
    <form action={saveSupplierAction} className="grid gap-3 border-t border-[var(--line)] bg-[#f7f7f3] p-4 lg:grid-cols-4">
      <input type="hidden" name="supplierId" value={supplier.id} />
      <input type="hidden" name="returnTo" value="/pipeline" />
      <input type="hidden" name="owner" value={supplier.owner} />
      <input type="hidden" name="hasShymkentRepresentative" value={supplier.hasShymkentRepresentative} />
      <input type="hidden" name="agencyFormatPossible" value={supplier.agencyFormatPossible} />
      <input type="hidden" name="noStockPurchaseRequired" value={supplier.noStockPurchaseRequired} />
      <input type="hidden" name="supplierInvoicesClient" value={supplier.supplierInvoicesClient} />
      <input type="hidden" name="supplierDeliversClient" value={supplier.supplierDeliversClient} />
      <input type="hidden" name="commissionFirstOrder" value={supplier.commissionFirstOrder} />
      <input type="hidden" name="commissionRepeatOrders" value={supplier.commissionRepeatOrders} />
      <input type="hidden" name="clientProtectionConfirmed" value={supplier.clientProtectionConfirmed} />
      <input type="hidden" name="samplesAvailable" value={supplier.samplesAvailable} />
      <input type="hidden" name="priceReceived" value={supplier.priceReceived} />
      <input type="hidden" name="documentsSdsReceived" value={supplier.documentsSdsReceived} />
      <input type="hidden" name="decisionMaker" value={supplier.decisionMaker ?? ""} />
      <input type="hidden" name="clientProtectionMechanism" value={supplier.clientProtectionMechanism ?? ""} />
      <input type="hidden" name="clientProtectionTerm" value={supplier.clientProtectionTerm ?? ""} />
      <input type="hidden" name="qualifiedMoq" value={supplier.qualifiedMoq ?? ""} />
      <input type="hidden" name="samplesComment" value={supplier.samplesComment ?? ""} />
      <input type="hidden" name="logisticsComment" value={supplier.logisticsComment ?? ""} />
      <input type="hidden" name="internalComment" value={supplier.internalComment ?? ""} />

      <label className="lg:col-span-2">
        <span className="label">Вставить ответ</span>
        <textarea className="field min-h-24" name="originalResponse" defaultValue={supplier.originalResponse ?? ""} placeholder="Точный текст ответа поставщика…" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
        <label>
          <span className="label">Результат</span>
          <select className="field" name="status" defaultValue={supplier.status}>
            {SUPPLIER_STATUSES.map((status) => (
              <option value={status} key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Пользователь</span>
          <select className="field" name="actor" defaultValue={supplier.owner}>
            {OWNERS.map((owner) => (
              <option value={owner} key={owner}>{owner}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Дата follow-up</span>
          <input className="field" type="date" name="nextActionAt" defaultValue={formatDateInput(supplier.nextActionAt)} />
        </label>
        <label>
          <span className="label">Следующее действие</span>
          <input className="field" name="nextAction" defaultValue={supplier.nextAction ?? ""} placeholder="Написать ЛПР и уточнить…" />
        </label>
      </div>
      <div className="flex justify-end lg:col-span-4">
        <SubmitButton pendingText="Сохраняю…">Сохранить результат</SubmitButton>
      </div>
    </form>
  );
}
