import { describe, expect, it } from "vitest";

import { calculateDashboard } from "@/lib/dashboard";

const now = new Date("2026-07-10T06:00:00.000Z");

function supplier(
  id: number,
  patch: Partial<Parameters<typeof calculateDashboard>[0][number]> = {},
) {
  return {
    id,
    name: `Поставщик ${id}`,
    category: "клининг",
    priority: "высокий",
    status: "не начато",
    ...patch,
  };
}

describe("calculateDashboard", () => {
  it("считает отправку и ответ по истории после перехода к менеджеру", () => {
    const result = calculateDashboard(
      [supplier(1, { status: "передали менеджеру", nextActionAt: "2026-07-10" }), supplier(2)],
      [
        {
          supplierId: 1,
          contactType: "supplier",
          actionType: "message_sent",
          newStatus: "сообщение отправлено",
          occurredAt: "2026-07-10T04:00:00.000Z",
        },
        {
          supplierId: 1,
          contactType: "supplier",
          actionType: "auto_reply_received",
          newStatus: "автоответ",
          responseText: "Автоматический ответ",
          occurredAt: "2026-07-10T04:05:00.000Z",
        },
        {
          supplierId: 1,
          contactType: "supplier",
          actionType: "forwarded_to_manager",
          newStatus: "передали менеджеру",
          occurredAt: "2026-07-10T04:10:00.000Z",
        },
      ],
      { now },
    );

    expect(result.messagesSent).toBe(1);
    expect(result.replied).toBe(1);
    expect(result.untouched).toBe(1);
    expect(result.needsFollowUp.map((item) => item.id)).toEqual([1]);
    expect(result.result).toBe("insufficient");
  });

  it("возвращает continue только после четырёх обязательных supplier-gate", () => {
    const qualified = supplier(1, {
      status: "обсуждение условий",
      agencyFormatPossible: "yes",
      noStockPurchaseRequired: "yes",
      supplierInvoicesClient: "yes",
      supplierDeliversClient: "yes",
      commissionRepeatOrders: "yes",
      clientProtectionConfirmed: "yes",
      clientProtectionMechanism: "Регистрация лида в договоре",
    });
    const discussing = supplier(2, {
      status: "обсуждение условий",
      agencyFormatPossible: "yes",
    });
    const result = calculateDashboard(
      [qualified, discussing],
      [
        {
          supplierId: 1,
          contactType: "supplier",
          actionType: "message_sent",
          occurredAt: "2026-07-10T04:00:00.000Z",
        },
      ],
      { now },
    );

    expect(result.gates.discussions.passed).toBe(true);
    expect(result.gates.protectedRepeat.passed).toBe(true);
    expect(result.gates.directInvoiceDelivery.passed).toBe(true);
    expect(result.gates.noStockRequired.passed).toBe(true);
    expect(result.result).toBe("continue");
  });

  it("возвращает kill после 48 часов, если обязательные условия не пройдены", () => {
    const result = calculateDashboard(
      [supplier(1)],
      [
        {
          supplierId: 1,
          contactType: "supplier",
          actionType: "message_sent",
          occurredAt: "2026-07-07T05:00:00.000Z",
        },
      ],
      { now },
    );

    expect(result.hoursRemaining).toBe(0);
    expect(result.result).toBe("kill");
  });
});
