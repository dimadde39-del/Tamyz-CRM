import { addHours, businessDateKey, isDueOnOrBeforeToday } from "@/lib/time";

type DashboardSupplier = {
  id: number;
  name: string;
  category?: string | null;
  status: string;
  priority: string;
  nextAction?: string | null;
  nextActionAt?: string | Date | null;
  agencyFormatPossible?: string | null;
  noStockPurchaseRequired?: string | null;
  supplierInvoicesClient?: string | null;
  supplierDeliversClient?: string | null;
  commissionRepeatOrders?: string | null;
  clientProtectionConfirmed?: string | null;
  clientProtectionMechanism?: string | null;
};

type DashboardActivity = {
  supplierId?: number | null;
  contactType: string;
  newStatus?: string | null;
  responseText?: string | null;
  actionType?: string | null;
  occurredAt: string | Date;
};

const responseStatuses = new Set([
  "автоответ",
  "передали менеджеру",
  "регион свободен",
  "регион закрыт",
  "обсуждение условий",
  "квалифицирован",
  "отказ",
  "follow-up",
  "закрыт",
]);

const interestStatuses = new Set(["регион свободен", "обсуждение условий", "квалифицирован"]);

function distinctSupplierIds(activities: DashboardActivity[], predicate: (activity: DashboardActivity) => boolean) {
  return new Set(
    activities
      .filter((activity) => activity.contactType === "supplier" && activity.supplierId && predicate(activity))
      .map((activity) => activity.supplierId as number),
  );
}

export function calculateDashboard(
  suppliers: DashboardSupplier[],
  activities: DashboardActivity[],
  options: { basketCount?: number; matchingBasketClients?: number; now?: Date } = {},
) {
  const now = options.now ?? new Date();
  const sentIds = distinctSupplierIds(
    activities,
    (activity) => activity.actionType === "message_sent" || activity.newStatus === "сообщение отправлено",
  );
  const repliedIds = distinctSupplierIds(
    activities,
    (activity) => Boolean(activity.responseText?.trim()) || Boolean(activity.newStatus && responseStatuses.has(activity.newStatus)),
  );
  const interestedIds = distinctSupplierIds(
    activities,
    (activity) => Boolean(activity.newStatus && interestStatuses.has(activity.newStatus)),
  );
  const refusedIds = distinctSupplierIds(activities, (activity) => activity.newStatus === "отказ");
  const regionClosedIds = distinctSupplierIds(activities, (activity) => activity.newStatus === "регион закрыт");

  suppliers.forEach((supplier) => {
    if (interestStatuses.has(supplier.status)) interestedIds.add(supplier.id);
    if (supplier.status === "отказ") refusedIds.add(supplier.id);
    if (supplier.status === "регион закрыт") regionClosedIds.add(supplier.id);
  });

  const discussions = suppliers.filter(
    (supplier) =>
      ["обсуждение условий", "квалифицирован"].includes(supplier.status) ||
      supplier.agencyFormatPossible === "yes",
  ).length;
  const protectedRepeat = suppliers.filter(
    (supplier) =>
      supplier.commissionRepeatOrders === "yes" &&
      supplier.clientProtectionConfirmed === "yes" &&
      Boolean(supplier.clientProtectionMechanism?.trim()),
  ).length;
  const directInvoiceDelivery = suppliers.some(
    (supplier) => supplier.supplierInvoicesClient === "yes" && supplier.supplierDeliversClient === "yes",
  );
  const noStockRequired = suppliers.some(
    (supplier) => supplier.noStockPurchaseRequired === "yes",
  );

  const gates = {
    discussions: { passed: discussions >= 2, current: discussions, target: 2 },
    protectedRepeat: { passed: protectedRepeat >= 1, current: protectedRepeat, target: 1 },
    directInvoiceDelivery: { passed: directInvoiceDelivery },
    noStockRequired: { passed: noStockRequired },
    baskets: { passed: (options.basketCount ?? 0) >= 5, current: options.basketCount ?? 0, target: 5 },
    matchingDemand: {
      passed: (options.matchingBasketClients ?? 0) >= 3,
      current: options.matchingBasketClients ?? 0,
      target: 3,
    },
  };

  const firstActivity = activities
    .map((activity) =>
      activity.occurredAt instanceof Date ? activity.occurredAt : new Date(activity.occurredAt),
    )
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const deadline = firstActivity ? addHours(firstActivity, 48) : null;
  const requiredPassed =
    gates.discussions.passed &&
    gates.protectedRepeat.passed &&
    gates.directInvoiceDelivery.passed &&
    gates.noStockRequired.passed;
  const result = requiredPassed ? "continue" : deadline && now >= deadline ? "kill" : "insufficient";
  const hoursRemaining = deadline
    ? Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 3_600_000))
    : null;

  const needsWriteToday = suppliers.filter(
    (supplier) =>
      supplier.status === "не начато" &&
      (supplier.priority === "высокий" ||
        (supplier.nextActionAt instanceof Date
          ? businessDateKey(supplier.nextActionAt) === businessDateKey(now)
          : supplier.nextActionAt?.slice(0, 10) === businessDateKey(now))),
  );
  const needsFollowUp = suppliers.filter(
    (supplier) => supplier.status !== "закрыт" && isDueOnOrBeforeToday(supplier.nextActionAt, now),
  );

  return {
    untouched: suppliers.filter((supplier) => supplier.status === "не начато" && !sentIds.has(supplier.id)).length,
    messagesSent: sentIds.size,
    replied: repliedIds.size,
    preliminaryInterest: interestedIds.size,
    refused: refusedIds.size,
    regionsClosed: regionClosedIds.size,
    needsWriteToday,
    needsFollowUp,
    gates,
    result,
    startedAt: firstActivity?.toISOString() ?? null,
    deadline: deadline?.toISOString() ?? null,
    hoursRemaining,
  };
}
