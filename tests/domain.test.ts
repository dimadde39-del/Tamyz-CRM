import { describe, expect, it } from "vitest";

import {
  FIRST_SUPPLIER_MESSAGE,
  buildWhatsAppUrl,
  getQualificationResult,
  normalizeWhatsAppNumber,
  type QualificationInput,
} from "@/lib/domain";

const EXACT_FIRST_SUPPLIER_MESSAGE =
  "Здравствуйте. Шымкент у вас уже закрыт действующим B2B-партнёром или регион свободен?\n\n" +
  "Мы собрали локальную базу автомоек, детейлинга и клининговых компаний и сейчас выбираем поставщика для пилота. Если регион свободен — с кем можно обсудить запуск продаж?";

describe("getQualificationResult", () => {
  it.each([
    [{}, "yellow"],
    [{ supplierInvoicesClient: "yes" }, "yellow"],
    [
      {
        supplierInvoicesClient: "yes",
        supplierDeliversClient: "yes",
        commissionRepeatOrders: "yes",
        clientProtectionConfirmed: "yes",
      },
      "green",
    ],
    [
      {
        noStockPurchaseRequired: "yes",
        supplierInvoicesClient: "yes",
        supplierDeliversClient: "yes",
        commissionRepeatOrders: "yes",
        clientProtectionConfirmed: "yes",
      },
      "green",
    ],
    [
      {
        noStockPurchaseRequired: "no",
        supplierInvoicesClient: "yes",
        supplierDeliversClient: "yes",
        commissionRepeatOrders: "yes",
        clientProtectionConfirmed: "yes",
      },
      "red",
    ],
    [{ commissionRepeatOrders: "no" }, "red"],
    [{ clientProtectionConfirmed: "no" }, "red"],
    [
      {
        supplierInvoicesClient: "no",
        supplierDeliversClient: "yes",
        commissionRepeatOrders: "yes",
        clientProtectionConfirmed: "yes",
      },
      "yellow",
    ],
  ] satisfies Array<[QualificationInput, "green" | "yellow" | "red"]>)(
    "returns %s for %j",
    (qualification, expected) => {
      expect(getQualificationResult(qualification)).toBe(expected);
    },
  );

  it("treats null fields as unknown instead of a rejection", () => {
    expect(
      getQualificationResult({
        noStockPurchaseRequired: null,
        supplierInvoicesClient: null,
        supplierDeliversClient: null,
        commissionRepeatOrders: null,
        clientProtectionConfirmed: null,
      }),
    ).toBe("yellow");
  });
});

describe("WhatsApp links", () => {
  it("keeps the user-approved first message byte-for-byte", () => {
    expect(FIRST_SUPPLIER_MESSAGE).toBe(EXACT_FIRST_SUPPLIER_MESSAGE);
  });

  it("builds the exact manual wa.me URL with the first usable number", () => {
    const expected = `https://wa.me/77778689009?text=${encodeURIComponent(EXACT_FIRST_SUPPLIER_MESSAGE)}`;
    const url = buildWhatsAppUrl("+7 (777) 868-90-09; +7 705 342-08-11");

    expect(url).toBe(expected);
    expect(new URL(url!).pathname).toBe("/77778689009");
    expect(new URL(url!).searchParams.get("text")).toBe(EXACT_FIRST_SUPPLIER_MESSAGE);
  });

  it.each([
    ["8 (701) 942-18-04", "77019421804"],
    ["701 942 18 04", "77019421804"],
    ["+7 701 942 18 04", "77019421804"],
    ["не найдено", null],
    ["00000000000", null],
    [null, null],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeWhatsAppNumber(input)).toBe(expected);
  });

  it("does not create a WhatsApp link when no WhatsApp contact is available", () => {
    expect(buildWhatsAppUrl("не найдено")).toBeNull();
    expect(buildWhatsAppUrl(null)).toBeNull();
  });
});
