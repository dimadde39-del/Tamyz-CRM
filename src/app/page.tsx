import {
  AlertTriangle,
  Ban,
  Building2,
  Check,
  Clock3,
  FlaskConical,
  MailCheck,
  MessageSquareReply,
  Send,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge, MetricCard, PageHeader, Panel } from "@/components/ui";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { db } from "@/db/client";
import { listActivities, listSuppliers } from "@/db/queries";
import { clientBasketItems, testBaskets } from "@/db/schema";
import { calculateDashboard } from "@/lib/dashboard";
import { compactText, formatDate } from "@/lib/format";
import { formatBusinessDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Сегодня" };
export const dynamic = "force-dynamic";

function GateRow({ passed, label, detail }: { passed: boolean; label: string; detail: string }) {
  return (
    <div className="flex gap-3 border-b border-[var(--line)] px-4 py-3 last:border-b-0">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${passed ? "border-[#8fb7a0] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[#d5bd83] bg-[var(--warning-soft)] text-[var(--warning)]"}`}>
        {passed ? <Check aria-hidden="true" size={13} strokeWidth={2.5} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
      <div><p className="text-[13px] font-[680]">{label}</p><p className="mt-0.5 text-[11px] text-[var(--muted)]">{detail}</p></div>
    </div>
  );
}

export default function TodayPage() {
  const suppliers = listSuppliers();
  const activities = listActivities(5000);
  const basketItems = db.select().from(clientBasketItems).all();
  const testBasketCount = db.select({ id: testBaskets.id }).from(testBaskets).all().length;
  const basketClients = new Set(basketItems.map((item) => item.clientId));
  const demandGroups = new Map<string, Set<number>>();
  basketItems.forEach((item) => {
    const key = (item.sku || `${item.brand ?? ""}|${item.product}`).trim().toLocaleLowerCase("ru");
    const group = demandGroups.get(key) ?? new Set<number>();
    group.add(item.clientId);
    demandGroups.set(key, group);
  });
  const matchingBasketClients = Math.max(0, ...[...demandGroups.values()].map((group) => group.size));
  const dashboard = calculateDashboard(suppliers, activities, {
    basketCount: basketClients.size,
    matchingBasketClients,
  });
  const resultTone = dashboard.result === "continue" ? "success" : dashboard.result === "kill" ? "danger" : "warning";
  const resultLabel = dashboard.result === "continue" ? "CONTINUE" : dashboard.result === "kill" ? "KILL" : "Недостаточно данных";
  const hoursLeft = dashboard.hoursRemaining;

  return (
    <>
      <PageHeader
        eyebrow="Операционный экран · Asia/Almaty"
        title="Сегодня"
        description="Сводка показывает только фактические действия и подтверждённые условия. Красивый каталог не считается прогрессом."
        actions={<Link className="btn btn-primary" href="/pipeline">Перейти к очереди</Link>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <MetricCard label="Не трогали" value={dashboard.untouched} detail="без события отправки" icon={Building2} />
        <MetricCard label="Отправлено" value={dashboard.messagesSent} detail="уникальных поставщиков" tone="info" icon={Send} />
        <MetricCard label="Ответили" value={dashboard.replied} detail="включая автоответ" tone="info" icon={MessageSquareReply} />
        <MetricCard label="Есть интерес" value={dashboard.preliminaryInterest} detail="свободен / обсуждают" tone="success" icon={MailCheck} />
        <MetricCard label="Отказали" value={dashboard.refused} detail="явный отказ" tone="danger" icon={Ban} />
        <MetricCard label="Регион закрыт" value={dashboard.regionsClosed} detail="есть представитель" tone="danger" icon={AlertTriangle} />
        <MetricCard label="Написать сегодня" value={dashboard.needsWriteToday.length} detail="высокий приоритет" tone="warning" icon={Send} />
        <MetricCard label="Follow-up" value={dashboard.needsFollowUp.length} detail="срок сегодня или прошёл" tone="warning" icon={Clock3} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <Panel title="Критерии решения" description="Четыре обязательных supplier-gate из текущего задания.">
          <GateRow passed={dashboard.gates.discussions.passed} label="2 поставщика обсуждают агентскую схему" detail={`${dashboard.gates.discussions.current} из ${dashboard.gates.discussions.target}`} />
          <GateRow passed={dashboard.gates.protectedRepeat.passed} label="1 подтверждает защиту клиента и комиссию с повторов" detail={`${dashboard.gates.protectedRepeat.current} из ${dashboard.gates.protectedRepeat.target}`} />
          <GateRow passed={dashboard.gates.directInvoiceDelivery.passed} label="Возможен прямой счёт и доставка клиенту" detail={dashboard.gates.directInvoiceDelivery.passed ? "подтверждено" : "пока неизвестно"} />
          <GateRow passed={dashboard.gates.noStockRequired.passed} label="Закупка на склад не требуется" detail={dashboard.gates.noStockRequired.passed ? "подтверждено" : "пока неизвестно"} />
          <div className="grid border-t border-[var(--line-strong)] bg-[#f7f7f3] sm:grid-cols-2">
            <GateRow passed={dashboard.gates.baskets.passed} label="5 реальных клиентских корзин" detail={`${dashboard.gates.baskets.current} из ${dashboard.gates.baskets.target} · сигнал спроса`} />
            <GateRow passed={dashboard.gates.matchingDemand.passed} label="3 клиента с похожими товарами" detail={`${dashboard.gates.matchingDemand.current} из ${dashboard.gates.matchingDemand.target} · сигнал спроса`} />
          </div>
        </Panel>

        <Panel title="Результат 48-часового теста">
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <Badge tone={resultTone}>{resultLabel}</Badge>
              <span className="text-[12px] text-[var(--muted)]">{hoursLeft === null ? "Тест ещё не начат" : hoursLeft > 0 ? `${hoursLeft} ч до решения` : "Окно завершено"}</span>
            </div>
            <p className="mt-4 text-[24px] font-[760] leading-tight tracking-[-0.03em]">
              {dashboard.result === "continue" ? "Supplier-gate пройден." : dashboard.result === "kill" ? "Обязательные условия не подтверждены вовремя." : "Рано принимать решение."}
            </p>
            <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
              {dashboard.result === "continue" ? "Можно продолжать полевой тест без товарного риска." : dashboard.result === "kill" ? "Не улучшать CRM ради надежды — закрыть или переформулировать гипотезу." : "Нужно получить письменные ответы по повторной комиссии, защите лида и прямой логистике."}
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4 text-[11px]"><div><dt className="label">Старт</dt><dd>{formatBusinessDateTime(dashboard.startedAt)}</dd></div><div><dt className="label">Дедлайн</dt><dd>{formatBusinessDateTime(dashboard.deadline)}</dd></div></dl>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Кому написать сегодня" actions={<Link className="text-[12px] font-semibold underline" href="/pipeline">Вся очередь</Link>}>
          <div className="divide-y divide-[var(--line)]">
            {dashboard.needsWriteToday.slice(0, 8).map((supplier) => <div className="flex items-start justify-between gap-3 px-4 py-3" key={supplier.id}><div><Link className="text-[13px] font-[680] underline decoration-black/20 underline-offset-2" href={`/suppliers/${supplier.id}`}>{supplier.name}</Link><p className="mt-0.5 text-[11px] text-[var(--muted)]">{compactText(supplier.category, 75)}</p></div><PriorityBadge priority={supplier.priority} /></div>)}
            {dashboard.needsWriteToday.length === 0 ? <p className="p-4 text-[12px] text-[var(--muted)]">Очередь на сегодня пуста.</p> : null}
          </div>
        </Panel>
        <Panel title="Кому нужен follow-up" actions={<Link className="text-[12px] font-semibold underline" href="/pipeline">Обработать</Link>}>
          <div className="divide-y divide-[var(--line)]">
            {dashboard.needsFollowUp.slice(0, 8).map((supplier) => <div className="flex items-start justify-between gap-3 px-4 py-3" key={supplier.id}><div><Link className="text-[13px] font-[680] underline decoration-black/20 underline-offset-2" href={`/suppliers/${supplier.id}`}>{supplier.name}</Link><p className="mt-0.5 text-[11px] text-[var(--muted)]">{compactText(supplier.nextAction, 100)}</p></div><div className="text-right"><StatusBadge status={supplier.status} /><p className="mt-1 text-[11px] text-[var(--muted)]">{formatDate(supplier.nextActionAt)}</p></div></div>)}
            {dashboard.needsFollowUp.length === 0 ? <p className="p-4 text-[12px] text-[var(--muted)]">Просроченных follow-up нет.</p> : null}
          </div>
        </Panel>
      </div>

      <Panel title="Тестовые ценовые корзины" description="Внутренние сценарии HoReCa не подменяют реальные клиентские корзины и не учитываются в сигнале спроса." className="mt-4" actions={<Link className="btn" href="/test-baskets"><FlaskConical aria-hidden="true" size={15} /> Открыть {testBasketCount}</Link>}>
        <div className="flex gap-3 p-4 text-[12px] leading-5 text-[var(--muted)]"><AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--warning)]" size={16} /><p>По IPANDA нужно подтвердить, может ли TAMYZ получать ценовой разрыв или получит отдельную агентскую комиссию. До ответа разница не является прибылью.</p></div>
      </Panel>
    </>
  );
}
