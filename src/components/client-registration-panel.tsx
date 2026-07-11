import Link from "next/link";

import {
  createClientRegistrationAction,
  introduceClientToSupplierAction,
  markClientRegistrationRequestSentAction,
  recordClientRegistrationResponseAction,
} from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { StatusBadge } from "@/components/status-badge";
import { Panel } from "@/components/ui";
import type { listClientRegistrations } from "@/db/queries";
import type { ClientBasketItem, Supplier } from "@/db/schema";
import {
  CLIENT_REGISTRATION_RESPONSE_LABELS,
  CLIENT_REGISTRATION_RESPONSE_TYPES,
  buildClientIntroductionMessage,
  buildClientRegistrationRequestMessage,
  type Owner,
} from "@/lib/domain";
import { formatBusinessDateTime } from "@/lib/time";

type RegistrationListItem = ReturnType<typeof listClientRegistrations>[number];

interface ClientRegistrationPanelProps {
  client: {
    id: number;
    name: string;
    bin: string | null;
    owner: Owner;
  };
  suppliers: Pick<Supplier, "id" | "name">[];
  registrations: RegistrationListItem[];
  basket: ClientBasketItem[];
}

export function ClientRegistrationPanel({
  client,
  suppliers,
  registrations,
  basket,
}: ClientRegistrationPanelProps) {
  return (
    <Panel
      className="mb-4"
      title={`Защита и передача клиента · ${registrations.length}`}
      description="Сначала получите письменное закрепление и условия комиссии. Система ничего не отправляет автоматически."
      actions={<Link className="btn" href={`/handoffs?clientId=${client.id}`}>Все передачи клиента</Link>}
    >
      <form
        action={createClientRegistrationAction}
        className="grid gap-3 bg-[#f7f7f3] p-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        <input type="hidden" name="clientId" value={client.id} />
        <input type="hidden" name="actor" value={client.owner} />
        <label className="xl:col-span-2">
          <span className="label">Поставщик *</span>
          <select className="field" name="supplierId" required defaultValue="">
            <option value="" disabled>Выберите поставщика</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Комиссия, % *</span>
          <input className="field" type="number" min="0" max="100" step="0.1" name="requestedCommissionPercent" required />
        </label>
        <label>
          <span className="label">Повторные заказы, мес. *</span>
          <input className="field" type="number" min="0" max="120" name="requestedRepeatCommissionMonths" required />
        </label>
        <label>
          <span className="label">Выплата после оплаты, раб. дней *</span>
          <input className="field" type="number" min="1" max="365" name="commissionPaymentBusinessDays" required />
        </label>
        <div className="flex justify-end sm:col-span-2 xl:col-span-5">
          <button className="btn btn-primary" type="submit">Создать регистрацию</button>
        </div>
      </form>

      <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
        {registrations.map((item) => {
          const { registration } = item;
          const requestMessage = buildClientRegistrationRequestMessage({
            clientName: item.clientName,
            clientBin: item.clientBin,
            requestedCommissionPercent: registration.requestedCommissionPercent,
            requestedRepeatCommissionMonths: registration.requestedRepeatCommissionMonths,
            commissionPaymentBusinessDays: registration.commissionPaymentBusinessDays,
          });
          const introductionMessage = buildClientIntroductionMessage({
            clientName: item.clientName,
            clientContactPerson: item.clientContactPerson,
            clientPhone: item.clientPhone,
            clientWhatsApp: item.clientWhatsApp,
            supplierName: item.supplierName,
            supplierPhone: item.supplierPhone,
            supplierWhatsApp: item.supplierWhatsApp,
            basket,
          });
          const canIntroduce = registration.status === "подтверждён";
          const wasIntroduced = registration.status === "стороны познакомлены";

          return (
            <article className="p-4" data-testid="registration-card" key={registration.id}>
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                <div>
                  <Link className="text-[14px] font-[720] underline decoration-black/20 underline-offset-2" href={`/suppliers/${registration.supplierId}`}>{item.supplierName}</Link>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">Регистрация #{registration.id} · создана {formatBusinessDateTime(registration.createdAt)}</p>
                </div>
                <StatusBadge status={registration.status} />
              </div>

              <dl className="mt-3 grid gap-3 text-[12px] sm:grid-cols-3 xl:grid-cols-6">
                <div><dt className="label">Запрошено</dt><dd>{registration.requestedCommissionPercent}%</dd></div>
                <div><dt className="label">Повторы</dt><dd>{registration.requestedRepeatCommissionMonths} мес.</dd></div>
                <div><dt className="label">Выплата</dt><dd>{registration.commissionPaymentBusinessDays} раб. дней</dd></div>
                <div><dt className="label">Запрос отправлен</dt><dd>{formatBusinessDateTime(registration.requestSentAt)}</dd></div>
                <div><dt className="label">Подтверждено</dt><dd>{formatBusinessDateTime(registration.confirmedAt)}</dd></div>
                <div><dt className="label">Знакомство</dt><dd>{formatBusinessDateTime(registration.introducedAt)}</dd></div>
              </dl>

              {registration.status === "черновик" ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="whitespace-pre-wrap rounded border border-[var(--line)] bg-white p-3 text-[13px] leading-5" data-testid="request-message">{requestMessage}</div>
                  <div className="flex flex-wrap content-start gap-2">
                    <CopyButton value={requestMessage} label="Копировать запрос" />
                    <form action={markClientRegistrationRequestSentAction}>
                      <input type="hidden" name="registrationId" value={registration.id} />
                      <input type="hidden" name="clientId" value={client.id} />
                      <input type="hidden" name="actor" value={client.owner} />
                      <button className="btn btn-primary" type="submit">Отметить запрос отправленным</button>
                    </form>
                  </div>
                </div>
              ) : null}

              {registration.status === "ожидает подтверждения" ? (
                <form action={recordClientRegistrationResponseAction} className="mt-4 grid gap-3 rounded border border-[var(--line)] bg-[#f7f7f3] p-3 sm:grid-cols-2 xl:grid-cols-4">
                  <input type="hidden" name="registrationId" value={registration.id} />
                  <input type="hidden" name="clientId" value={client.id} />
                  <input type="hidden" name="actor" value={client.owner} />
                  <label>
                    <span className="label">Ответ поставщика *</span>
                    <select className="field" name="responseType" required defaultValue="confirmed">
                      {CLIENT_REGISTRATION_RESPONSE_TYPES.map((responseType) => (
                        <option key={responseType} value={responseType}>{CLIENT_REGISTRATION_RESPONSE_LABELS[responseType]}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="label">Комиссия из ответа, %</span>
                    <input className="field" type="number" min="0" max="100" step="0.1" name="confirmedCommissionPercent" />
                  </label>
                  <label>
                    <span className="label">Срок из ответа, мес.</span>
                    <input className="field" type="number" min="0" max="120" name="confirmedRepeatCommissionMonths" />
                  </label>
                  <label className="sm:col-span-2 xl:col-span-4">
                    <span className="label">Комментарий / точный текст ответа *</span>
                    <textarea className="field min-h-24" name="supplierResponseText" required />
                  </label>
                  <div className="flex justify-end sm:col-span-2 xl:col-span-4">
                    <button className="btn btn-primary" type="submit">Зафиксировать ответ</button>
                  </div>
                </form>
              ) : null}

              {registration.supplierResponseText ? (
                <div className="mt-4 rounded border border-[var(--line)] bg-white p-3 text-[12px]">
                  <p className="label">Точный текст ответа поставщика</p>
                  <p className="whitespace-pre-wrap">{registration.supplierResponseText}</p>
                  <p className="mt-2 text-[var(--muted)]">Условия из ответа: {registration.confirmedCommissionPercent ?? "—"}% · {registration.confirmedRepeatCommissionMonths ?? "—"} мес.</p>
                </div>
              ) : null}

              {canIntroduce || wasIntroduced ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="whitespace-pre-wrap rounded border border-[#b8d1c2] bg-[var(--accent-soft)] p-3 text-[13px] leading-5" data-testid="introduction-message">{introductionMessage}</div>
                  <div className="flex flex-wrap content-start gap-2">
                    <CopyButton value={introductionMessage} label="Копировать знакомство" />
                    {canIntroduce ? (
                      <form action={introduceClientToSupplierAction}>
                        <input type="hidden" name="registrationId" value={registration.id} />
                        <input type="hidden" name="clientId" value={client.id} />
                        <input type="hidden" name="actor" value={client.owner} />
                        <button className="btn btn-primary" type="submit">Отметить стороны познакомленными</button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ) : registration.status !== "уже является клиентом поставщика" && registration.status !== "условия отклонены" ? (
                <div className="mt-4 rounded border border-[#e2cc98] bg-[var(--warning-soft)] p-3 text-[12px] text-[#795711]" role="note">
                  Знакомство недоступно: сначала поставщик должен письменно подтвердить закрепление клиента и условия комиссии.
                </div>
              ) : null}
            </article>
          );
        })}
        {registrations.length === 0 ? (
          <p className="p-4 text-[12px] text-[var(--muted)]">Регистраций у поставщиков пока нет.</p>
        ) : null}
      </div>
    </Panel>
  );
}
