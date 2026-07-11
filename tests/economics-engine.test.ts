import { describe, expect, it } from "vitest";

import {
  calculateConcentrate,
  calculateEconomics,
  exactRatio,
  formatBasisPoints,
  formatBpsForInput,
  formatExactMoney,
  formatExactRatio,
  formatMilliForInput,
  formatMinorForInput,
  parseKztToMinor,
  parsePercentToBps,
  parseQuantityToMilli,
  roundExactRatio,
  roundRatio,
  type EconomicsScenarioInput,
  type OrderLineInput,
} from "@/lib/economics-engine";

const kzt = (amount: number) => amount * 100;

function line(
  dealerUnitPriceMinor: number,
  clientUnitPriceMinor: number,
  quantityMilli = 1_000,
): OrderLineInput {
  return {
    key: "line-1",
    name: "Тестовая позиция",
    quantityMilli,
    dealerUnitPriceMinor,
    clientUnitPriceMinor,
  };
}

function scenario(
  overrides: Partial<EconomicsScenarioInput> = {},
): EconomicsScenarioInput {
  return {
    lines: [line(kzt(60), kzt(100))],
    earningMode: "dealer_spread",
    discountBps: 0,
    commissionBps: 0,
    fixedFeeMinor: 0,
    minimumOrderMinor: 0,
    deliveryMinor: 0,
    deliveryPayer: "supplier",
    otherDirectExpensesMinor: 0,
    repeatOrdersPerMonthMilli: 0,
    repeatCommissionMonths: 0,
    termsStatus: "confirmed",
    ...overrides,
  };
}

describe("TAMYZ Economics Engine", () => {
  describe("режимы дохода", () => {
    it("точно считает 10% referral commission с IPANDA 50 056 ₸ и не добавляет дилерскую разницу или fixed fee", () => {
      const result = calculateEconomics(
        scenario({
          lines: [line(kzt(41_195), kzt(50_056))],
          earningMode: "referral_commission",
          commissionBps: 1_000,
          fixedFeeMinor: kzt(999),
        }),
      );

      expect(result.dealerBasketMinor).toBe(4_119_500);
      expect(result.clientBasketMinor).toBe(5_005_600);
      expect(result.grossIncomeMinor).toBe(500_560);
      expect(result.netIncomeBeforeTaxMinor).toBe(500_560);
      expect(result.incomePerOrderMinor).toBe(500_560);
      expect(formatMinorForInput(result.grossIncomeMinor)).toBe("5005.6");
    });

    it("возвращает дилерскую разницу IPANDA 8 861 ₸ и эффективную маржу 17,7%", () => {
      const result = calculateEconomics(
        scenario({
          lines: [line(kzt(41_195), kzt(50_056))],
          earningMode: "dealer_spread",
          commissionBps: 9_999,
          fixedFeeMinor: kzt(999),
        }),
      );

      expect(result.grossIncomeMinor).toBe(886_100);
      expect(result.netIncomeBeforeTaxMinor).toBe(886_100);
      expect(result.effectiveMarginBps).toBe(1_770);
      expect(formatBasisPoints(result.effectiveMarginBps)).toBe("17,7%");
    });

    it("использует только fixed fee, даже когда комиссия и дилерская разница ненулевые", () => {
      const result = calculateEconomics(
        scenario({
          lines: [line(kzt(20), kzt(100))],
          earningMode: "fixed_fee",
          commissionBps: 8_500,
          fixedFeeMinor: 77_777,
        }),
      );

      expect(result.grossIncomeMinor).toBe(77_777);
      expect(result.netIncomeBeforeTaxMinor).toBe(77_777);
      expect(result.grossIncomeMinor).not.toBe(77_777 + kzt(80));
      expect(result.grossIncomeMinor).not.toBe(77_777 + kzt(85));
    });

    it("поддерживает дробный процент в basis points без floating point", () => {
      const commissionBps = parsePercentToBps("12,5");
      const result = calculateEconomics(
        scenario({
          lines: [line(0, kzt(50_056))],
          earningMode: "referral_commission",
          commissionBps,
        }),
      );

      expect(commissionBps).toBe(1_250);
      expect(result.grossIncomeMinor).toBe(625_700);
    });
  });

  describe("скидка, доставка и допустимость корзины", () => {
    it("показывает влияние текущей скидки и чувствительность к ±1 п.п.", () => {
      const result = calculateEconomics(
        scenario({
          lines: [line(kzt(60), kzt(100))],
          discountBps: 1_000,
        }),
      );

      expect(result.discountMinor).toBe(kzt(10));
      expect(result.discountedGoodsMinor).toBe(kzt(90));
      expect(result.finalClientInvoiceMinor).toBe(kzt(90));
      expect(result.netIncomeBeforeTaxMinor).toBe(kzt(30));
      expect(result.discountSensitivity).toEqual({
        zeroDiscountNetIncomeMinor: kzt(40),
        currentVsZeroMinor: -kzt(10),
        lowerDiscountBps: 900,
        lowerDiscountNetIncomeMinor: kzt(31),
        lowerDiscountChangeMinor: kzt(1),
        higherDiscountBps: 1_100,
        higherDiscountNetIncomeMinor: kzt(29),
        higherDiscountChangeMinor: -kzt(1),
      });
    });

    it.each([
      {
        payer: "supplier" as const,
        invoiceMinor: kzt(5_000),
        expensesMinor: kzt(100),
        incomeMinor: kzt(900),
      },
      {
        payer: "client" as const,
        invoiceMinor: kzt(5_200),
        expensesMinor: kzt(100),
        incomeMinor: kzt(900),
      },
      {
        payer: "tamyz" as const,
        invoiceMinor: kzt(5_000),
        expensesMinor: kzt(300),
        incomeMinor: kzt(700),
      },
    ])(
      "учитывает доставку за счёт $payer ровно один раз",
      ({ payer, invoiceMinor, expensesMinor, incomeMinor }) => {
        const result = calculateEconomics(
          scenario({
            lines: [line(0, kzt(5_000))],
            earningMode: "fixed_fee",
            fixedFeeMinor: kzt(1_000),
            deliveryMinor: kzt(200),
            deliveryPayer: payer,
            otherDirectExpensesMinor: kzt(100),
          }),
        );

        expect(result.grossIncomeMinor).toBe(kzt(1_000));
        expect(result.finalClientInvoiceMinor).toBe(invoiceMinor);
        expect(result.directExpensesMinor).toBe(expensesMinor);
        expect(result.netIncomeBeforeTaxMinor).toBe(incomeMinor);
      },
    );

    it("блокирует корзину с отрицательной маржой", () => {
      const result = calculateEconomics(
        scenario({
          lines: [line(kzt(120), kzt(100))],
          earningMode: "dealer_spread",
        }),
      );

      expect(result.grossIncomeMinor).toBe(-kzt(20));
      expect(result.netIncomeBeforeTaxMinor).toBe(-kzt(20));
      expect(result.effectiveMarginBps).toBe(-2_000);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "negative_margin", severity: "danger" }),
        ]),
      );
      expect(result.offerStatus).toBe("not_offerable");
    });

    it("обрабатывает нулевую клиентскую цену без деления на ноль", () => {
      const result = calculateEconomics(
        scenario({
          lines: [line(0, 0)],
          earningMode: "referral_commission",
          commissionBps: 1_000,
          fixedFeeMinor: kzt(500),
        }),
      );

      expect(result.clientBasketMinor).toBe(0);
      expect(result.grossIncomeMinor).toBe(0);
      expect(result.effectiveMarginBps).toBeNull();
      expect(result.warnings.map(({ code }) => code)).toContain("zero_client_price");
      expect(result.offerStatus).toBe("not_offerable");
    });

    it("помечает предварительные условия и заказ ниже минимальной суммы", () => {
      const result = calculateEconomics(
        scenario({
          termsStatus: "draft",
          minimumOrderMinor: kzt(101),
        }),
      );

      expect(result.preliminary).toBe(true);
      expect(result.warnings.map(({ code }) => code)).toEqual(
        expect.arrayContaining(["draft_terms", "below_minimum_order"]),
      );
      expect(result.offerStatus).toBe("not_offerable");
    });

    it("отправляет положительную, но слишком низкую маржу на ручную проверку", () => {
      const result = calculateEconomics(
        scenario({
          lines: [line(0, kzt(100))],
          earningMode: "fixed_fee",
          fixedFeeMinor: kzt(4),
        }),
      );

      expect(result.effectiveMarginBps).toBe(400);
      expect(result.warnings.map(({ code }) => code)).toContain("low_margin");
      expect(result.offerStatus).toBe("review");
    });
  });

  describe("повторные заказы", () => {
    it("строит сценарии 3/6/12 месяцев и ограничивает повторы сроком комиссии", () => {
      const result = calculateEconomics(
        scenario({
          earningMode: "fixed_fee",
          fixedFeeMinor: kzt(1_000),
          repeatOrdersPerMonthMilli: 1_500,
          repeatCommissionMonths: 6,
        }),
      );

      expect(result.scenarios).toEqual([
        {
          months: 3,
          eligibleRepeatMonths: 3,
          repeatOrdersMilli: 4_500,
          totalOrdersMilli: 5_500,
          incomeBeforeTaxMinor: kzt(5_500),
        },
        {
          months: 6,
          eligibleRepeatMonths: 6,
          repeatOrdersMilli: 9_000,
          totalOrdersMilli: 10_000,
          incomeBeforeTaxMinor: kzt(10_000),
        },
        {
          months: 12,
          eligibleRepeatMonths: 6,
          repeatOrdersMilli: 9_000,
          totalOrdersMilli: 10_000,
          incomeBeforeTaxMinor: kzt(10_000),
        },
      ]);
    });
  });

  describe("концентрированная химия", () => {
    const concentrateBase = {
      packageVolumeMilliliters: 5_000,
      packagePriceMinor: kzt(9_856),
      dilutionRatioN: 100,
      standardContainerVolumeMilliliters: 10_000,
    };

    it("считает 5 л при 1:100 как концентрат + вода: 505 л и хранит цену литра точной дробью", () => {
      const result = calculateConcentrate({
        ...concentrateBase,
        interpretation: "concentrate_plus_water",
      });

      expect(result.interpretation).toBe("concentrate_plus_water");
      expect(result.interpretationLabel).toContain("+ 100");
      expect(result.totalSolutionVolumeMilliliters).toBe(505_000);
      expect(result.totalSolutionLiters).toEqual(exactRatio(505n, 1n));
      expect(result.costPerLiterMinor).toEqual(exactRatio(197_120n, 101n));
      expect(result.costPerTenLitersMinor).toEqual(exactRatio(1_971_200n, 101n));
      expect(result.standardContainerCount).toEqual(exactRatio(101n, 2n));
      expect(result.fullStandardContainers).toBe(50);
      expect(result.remainderMilliliters).toBe(5_000);

      expect(formatExactRatio(result.costPerLiterMinor, 3)).toBe("1951,683");
      expect(roundExactRatio(result.costPerLiterMinor)).toBe(1_952n);
      expect(formatExactMoney(result.costPerLiterMinor)).toContain("19,52");
    });

    it("считает 1 часть в 100 частях готового раствора как 500 л", () => {
      const result = calculateConcentrate({
        ...concentrateBase,
        interpretation: "concentrate_in_final_solution",
      });

      expect(result.interpretation).toBe("concentrate_in_final_solution");
      expect(result.interpretationLabel).toContain("в 100");
      expect(result.totalSolutionVolumeMilliliters).toBe(500_000);
      expect(result.totalSolutionLiters).toEqual(exactRatio(500n, 1n));
      expect(result.costPerLiterMinor).toEqual(exactRatio(9_856n, 5n));
      expect(result.costPerTenLitersMinor).toEqual(exactRatio(19_712n, 1n));
      expect(result.standardContainerCount).toEqual(exactRatio(50n, 1n));
      expect(result.fullStandardContainers).toBe(50);
      expect(result.remainderMilliliters).toBe(0);
    });

    it("сравнивает концентрат с текущей стоимостью раствора в деньгах и процентах", () => {
      const result = calculateConcentrate({
        ...concentrateBase,
        interpretation: "concentrate_plus_water",
        currentSolutionCostPerLiterMinor: kzt(50),
      });

      expect(result.savingsPerLiterMinor).toEqual(exactRatio(307_880n, 101n));
      expect(result.savingsForTotalVolumeMinor).toEqual(exactRatio(1_539_400n, 1n));
      expect(result.savingsPercent).toEqual(exactRatio(7_697n, 12_625n));
      expect(
        formatExactRatio(
          exactRatio(
            result.savingsPercent!.numerator * 100n,
            result.savingsPercent!.denominator,
          ),
          2,
        ),
      ).toBe("60,97");
    });
  });

  describe("точный ввод, округление и форматирование", () => {
    it("отклоняет агрегат, вышедший за безопасный целочисленный диапазон", () => {
      expect(() =>
        calculateEconomics(
          scenario({
            lines: [line(0, Number.MAX_SAFE_INTEGER)],
            deliveryPayer: "client",
            deliveryMinor: Number.MAX_SAFE_INTEGER - 1,
          }),
        ),
      ).toThrow(/безопасн/);
    });

    it("парсит KZT, проценты и количества в целые фиксированного масштаба", () => {
      expect(parseKztToMinor("50\u202f056,60")).toBe(5_005_660);
      expect(parsePercentToBps("12,50")).toBe(1_250);
      expect(parseQuantityToMilli("1,250")).toBe(1_250);
      expect(formatMinorForInput(5_005_660)).toBe("50056.6");
      expect(formatBpsForInput(1_250)).toBe("12.5");
      expect(formatMilliForInput(1_250)).toBe("1.25");
    });

    it("отклоняет лишнюю точность и отрицательный ввод", () => {
      expect(() => parsePercentToBps("12,345")).toThrow(RangeError);
      expect(() => parseKztToMinor("-1")).toThrow(TypeError);
      expect(() => parseQuantityToMilli("не число")).toThrow(TypeError);
    });

    it("округляет точные половины от нуля, включая сумму дробного количества", () => {
      expect(roundRatio(1n, 2n)).toBe(1n);
      expect(roundRatio(-1n, 2n)).toBe(-1n);

      const result = calculateEconomics(
        scenario({
          lines: [line(1, 1, 500)],
          earningMode: "dealer_spread",
        }),
      );
      expect(result.lines[0].dealerTotalMinor).toBe(1);
      expect(result.lines[0].clientTotalMinor).toBe(1);
    });
  });
});
