/**
 * TAMYZ Economics Engine.
 *
 * The module is deliberately independent from React, Next.js and the database.
 * All money is expressed in the smallest KZT unit (1 tiyn; 100 tiyn = 1 KZT),
 * percentages in basis points, and quantities in thousandths of a unit.
 */

export const MINOR_UNITS_PER_KZT = 100;
export const BASIS_POINTS_SCALE = 10_000;
export const QUANTITY_SCALE = 1_000;
export const LOW_MARGIN_THRESHOLD_BPS = 500;
export const ECONOMICS_ENGINE_VERSION = 1;

export type EarningMode = "referral_commission" | "dealer_spread" | "fixed_fee";
export type DeliveryPayer = "supplier" | "client" | "tamyz";
export type TermsStatus = "draft" | "confirmed";

export interface OrderLineInput {
  key: string;
  name: string;
  quantityMilli: number;
  dealerUnitPriceMinor: number;
  clientUnitPriceMinor: number;
}

export interface EconomicsScenarioInput {
  lines: OrderLineInput[];
  earningMode: EarningMode;
  discountBps: number;
  commissionBps: number;
  fixedFeeMinor: number;
  minimumOrderMinor: number;
  deliveryMinor: number;
  deliveryPayer: DeliveryPayer;
  otherDirectExpensesMinor: number;
  repeatOrdersPerMonthMilli: number;
  repeatCommissionMonths: number;
  /** Commercial payout term; shown in comparisons but does not change earned income. */
  commissionPaymentBusinessDays?: number;
  termsStatus: TermsStatus;
}

export interface CalculatedOrderLine extends OrderLineInput {
  dealerTotalMinor: number;
  clientTotalMinor: number;
}

export type EconomicsWarningCode =
  | "draft_terms"
  | "empty_basket"
  | "zero_client_price"
  | "below_minimum_order"
  | "negative_margin"
  | "low_margin";

export interface EconomicsWarning {
  code: EconomicsWarningCode;
  severity: "warning" | "danger";
  message: string;
}

export interface HorizonScenario {
  months: 3 | 6 | 12;
  eligibleRepeatMonths: number;
  repeatOrdersMilli: number;
  totalOrdersMilli: number;
  incomeBeforeTaxMinor: number;
}

export interface DiscountSensitivity {
  zeroDiscountNetIncomeMinor: number;
  currentVsZeroMinor: number;
  lowerDiscountBps: number;
  lowerDiscountNetIncomeMinor: number;
  lowerDiscountChangeMinor: number;
  higherDiscountBps: number;
  higherDiscountNetIncomeMinor: number;
  higherDiscountChangeMinor: number;
}

export interface EconomicsScenarioResult {
  lines: CalculatedOrderLine[];
  dealerBasketMinor: number;
  clientBasketMinor: number;
  discountMinor: number;
  discountedGoodsMinor: number;
  finalClientInvoiceMinor: number;
  grossIncomeMinor: number;
  directExpensesMinor: number;
  netIncomeBeforeTaxMinor: number;
  incomePerOrderMinor: number;
  effectiveMarginBps: number | null;
  preliminary: boolean;
  offerStatus: "offerable" | "review" | "not_offerable";
  scenarios: HorizonScenario[];
  discountSensitivity: DiscountSensitivity;
  warnings: EconomicsWarning[];
  assumptions: string[];
}

function assertSafeInteger(value: number, name: string, minimum = 0): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${name} должен быть безопасным целым числом не меньше ${minimum}`);
  }
}

function toSafeNumber(value: bigint, name: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${name} выходит за безопасный диапазон целых чисел`);
  }
  return result;
}

/** Integer division rounded to the nearest integer; exact halves go away from zero. */
export function roundRatio(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new RangeError("Деление на ноль");
  const negative = (numerator < 0n) !== (denominator < 0n);
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const quotient = absoluteNumerator / absoluteDenominator;
  const remainder = absoluteNumerator % absoluteDenominator;
  const rounded = remainder * 2n >= absoluteDenominator ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

function calculateLineTotal(unitPriceMinor: number, quantityMilli: number): number {
  return toSafeNumber(
    roundRatio(BigInt(unitPriceMinor) * BigInt(quantityMilli), BigInt(QUANTITY_SCALE)),
    "Сумма позиции",
  );
}

function percentageOf(amountMinor: number, basisPoints: number): number {
  return toSafeNumber(
    roundRatio(BigInt(amountMinor) * BigInt(basisPoints), BigInt(BASIS_POINTS_SCALE)),
    "Процент от суммы",
  );
}

function calculateOrderAtDiscount(
  input: EconomicsScenarioInput,
  dealerBasketMinor: number,
  clientBasketMinor: number,
  discountBps: number,
) {
  const discountMinor = percentageOf(clientBasketMinor, discountBps);
  const discountedGoodsMinor = clientBasketMinor - discountMinor;
  const finalClientInvoiceMinor = toSafeNumber(
    BigInt(discountedGoodsMinor) +
      BigInt(input.deliveryPayer === "client" ? input.deliveryMinor : 0),
    "Итоговый счёт клиенту",
  );

  let grossIncomeMinor: number;
  switch (input.earningMode) {
    case "referral_commission":
      grossIncomeMinor = percentageOf(discountedGoodsMinor, input.commissionBps);
      break;
    case "dealer_spread":
      grossIncomeMinor = toSafeNumber(
        BigInt(discountedGoodsMinor) - BigInt(dealerBasketMinor),
        "Дилерская разница",
      );
      break;
    case "fixed_fee":
      grossIncomeMinor = input.fixedFeeMinor;
      break;
  }

  const directExpensesMinor = toSafeNumber(
    BigInt(input.otherDirectExpensesMinor) +
      BigInt(input.deliveryPayer === "tamyz" ? input.deliveryMinor : 0),
    "Прямые расходы TAMYZ",
  );
  const netIncomeBeforeTaxMinor = toSafeNumber(
    BigInt(grossIncomeMinor) - BigInt(directExpensesMinor),
    "Доход TAMYZ до налогов",
  );

  return {
    discountMinor,
    discountedGoodsMinor,
    finalClientInvoiceMinor,
    grossIncomeMinor,
    directExpensesMinor,
    netIncomeBeforeTaxMinor,
  };
}

function validateScenarioInput(input: EconomicsScenarioInput): void {
  if (!Array.isArray(input.lines)) throw new TypeError("Корзина должна быть массивом позиций");
  input.lines.forEach((line, index) => {
    assertSafeInteger(line.quantityMilli, `Количество позиции ${index + 1}`);
    assertSafeInteger(line.dealerUnitPriceMinor, `Дилерская цена позиции ${index + 1}`);
    assertSafeInteger(line.clientUnitPriceMinor, `Цена клиенту позиции ${index + 1}`);
  });
  assertSafeInteger(input.discountBps, "Скидка");
  assertSafeInteger(input.commissionBps, "Комиссия");
  if (input.discountBps > BASIS_POINTS_SCALE || input.commissionBps > BASIS_POINTS_SCALE) {
    throw new RangeError("Скидка и комиссия не могут превышать 100%");
  }
  assertSafeInteger(input.fixedFeeMinor, "Фиксированная выплата");
  assertSafeInteger(input.minimumOrderMinor, "Минимальная сумма заказа");
  assertSafeInteger(input.deliveryMinor, "Стоимость доставки");
  assertSafeInteger(input.otherDirectExpensesMinor, "Другие прямые расходы");
  assertSafeInteger(input.repeatOrdersPerMonthMilli, "Повторные заказы в месяц");
  assertSafeInteger(input.repeatCommissionMonths, "Срок повторного вознаграждения");
  if (input.commissionPaymentBusinessDays !== undefined) {
    assertSafeInteger(input.commissionPaymentBusinessDays, "Срок выплаты комиссии");
  }
}

export function calculateEconomics(input: EconomicsScenarioInput): EconomicsScenarioResult {
  validateScenarioInput(input);

  const lines = input.lines.map((line) => ({
    ...line,
    dealerTotalMinor: calculateLineTotal(line.dealerUnitPriceMinor, line.quantityMilli),
    clientTotalMinor: calculateLineTotal(line.clientUnitPriceMinor, line.quantityMilli),
  }));
  const dealerBasketMinor = toSafeNumber(
    lines.reduce((sum, line) => sum + BigInt(line.dealerTotalMinor), 0n),
    "Дилерская стоимость корзины",
  );
  const clientBasketMinor = toSafeNumber(
    lines.reduce((sum, line) => sum + BigInt(line.clientTotalMinor), 0n),
    "Клиентская стоимость корзины",
  );

  const current = calculateOrderAtDiscount(
    input,
    dealerBasketMinor,
    clientBasketMinor,
    input.discountBps,
  );
  const effectiveMarginBps = current.finalClientInvoiceMinor === 0
    ? null
    : toSafeNumber(
        roundRatio(
          BigInt(current.netIncomeBeforeTaxMinor) * BigInt(BASIS_POINTS_SCALE),
          BigInt(current.finalClientInvoiceMinor),
        ),
        "Эффективная маржа",
      );

  const scenarios = ([3, 6, 12] as const).map((months): HorizonScenario => {
    const eligibleRepeatMonths = Math.min(months, input.repeatCommissionMonths);
    const repeatOrdersMilli = toSafeNumber(
      BigInt(input.repeatOrdersPerMonthMilli) * BigInt(eligibleRepeatMonths),
      `Повторные заказы за ${months} месяцев`,
    );
    const totalOrdersMilli = toSafeNumber(
      BigInt(QUANTITY_SCALE) + BigInt(repeatOrdersMilli),
      `Общее число заказов за ${months} месяцев`,
    );
    return {
      months,
      eligibleRepeatMonths,
      repeatOrdersMilli,
      totalOrdersMilli,
      incomeBeforeTaxMinor: toSafeNumber(
        roundRatio(
          BigInt(current.netIncomeBeforeTaxMinor) * BigInt(totalOrdersMilli),
          BigInt(QUANTITY_SCALE),
        ),
        `Доход сценария на ${months} месяцев`,
      ),
    };
  });

  const zeroDiscount = calculateOrderAtDiscount(input, dealerBasketMinor, clientBasketMinor, 0);
  const lowerDiscountBps = Math.max(0, input.discountBps - 100);
  const higherDiscountBps = Math.min(BASIS_POINTS_SCALE, input.discountBps + 100);
  const lowerDiscount = calculateOrderAtDiscount(
    input,
    dealerBasketMinor,
    clientBasketMinor,
    lowerDiscountBps,
  );
  const higherDiscount = calculateOrderAtDiscount(
    input,
    dealerBasketMinor,
    clientBasketMinor,
    higherDiscountBps,
  );
  const discountSensitivity: DiscountSensitivity = {
    zeroDiscountNetIncomeMinor: zeroDiscount.netIncomeBeforeTaxMinor,
    currentVsZeroMinor:
      current.netIncomeBeforeTaxMinor - zeroDiscount.netIncomeBeforeTaxMinor,
    lowerDiscountBps,
    lowerDiscountNetIncomeMinor: lowerDiscount.netIncomeBeforeTaxMinor,
    lowerDiscountChangeMinor:
      lowerDiscount.netIncomeBeforeTaxMinor - current.netIncomeBeforeTaxMinor,
    higherDiscountBps,
    higherDiscountNetIncomeMinor: higherDiscount.netIncomeBeforeTaxMinor,
    higherDiscountChangeMinor:
      higherDiscount.netIncomeBeforeTaxMinor - current.netIncomeBeforeTaxMinor,
  };

  const warnings: EconomicsWarning[] = [];
  if (input.termsStatus === "draft") {
    warnings.push({
      code: "draft_terms",
      severity: "warning",
      message: "Условия не подтверждены поставщиком: расчёт предварительный.",
    });
  }
  if (lines.length === 0) {
    warnings.push({ code: "empty_basket", severity: "danger", message: "Корзина пуста." });
  }
  if (clientBasketMinor === 0) {
    warnings.push({
      code: "zero_client_price",
      severity: "danger",
      message: "Стоимость корзины для клиента равна нулю.",
    });
  }
  if (
    input.minimumOrderMinor > 0 &&
    current.discountedGoodsMinor < input.minimumOrderMinor
  ) {
    warnings.push({
      code: "below_minimum_order",
      severity: "danger",
      message: "Стоимость товаров после скидки ниже минимальной суммы заказа.",
    });
  }
  if (current.netIncomeBeforeTaxMinor < 0) {
    warnings.push({
      code: "negative_margin",
      severity: "danger",
      message: "Доход до налогов отрицательный: такую корзину нельзя предлагать без изменения условий.",
    });
  } else if (effectiveMarginBps !== null && effectiveMarginBps < LOW_MARGIN_THRESHOLD_BPS) {
    warnings.push({
      code: "low_margin",
      severity: "warning",
      message: `Эффективная маржа ниже ${LOW_MARGIN_THRESHOLD_BPS / 100}% и требует ручной проверки.`,
    });
  }

  const hasBlockingWarning = warnings.some(
    (warning) =>
      warning.code === "empty_basket" ||
      warning.code === "zero_client_price" ||
      warning.code === "below_minimum_order" ||
      warning.code === "negative_margin",
  );
  const offerStatus = hasBlockingWarning
    ? "not_offerable"
    : warnings.length > 0
      ? "review"
      : "offerable";

  return {
    lines,
    dealerBasketMinor,
    clientBasketMinor,
    ...current,
    incomePerOrderMinor: current.netIncomeBeforeTaxMinor,
    effectiveMarginBps,
    preliminary: input.termsStatus === "draft",
    offerStatus,
    scenarios,
    discountSensitivity,
    warnings,
    assumptions: [
      "Все суммы рассчитаны в тиынах (1 ₸ = 100 тиын); промежуточные денежные значения не используют floating point.",
      "Сумма каждой позиции округляется до тиына математически; ровно половина тиына округляется от нуля.",
      "Скидка применяется к товарам до доставки; минимальный заказ проверяется по товарам после скидки, без доставки.",
      "Комиссия считается от оплаченной стоимости товаров после скидки, без доставки, и округляется до тиына по тому же правилу.",
      "Режимы вознаграждения взаимоисключающие: комиссия, дилерская разница и фиксированная выплата никогда не суммируются.",
      "Доставка за счёт клиента добавляется к счёту, но не к доходу TAMYZ; доставка за счёт TAMYZ является прямым расходом.",
      "Эффективная маржа — доход TAMYZ до налогов, делённый на итоговый счёт клиенту.",
      "Сценарии 3/6/12 месяцев включают один первый заказ и заданное число повторов только в пределах срока повторного вознаграждения.",
      "Нулевое значение условия означает только явное допущение этого сценария и не доказывает, что комиссия, MOQ, доставка или расходы фактически отсутствуют.",
      "Налоги, бухгалтерские расходы и платёжные комиссии не рассчитываются, если оператор не внёс их как прямые расходы.",
    ],
  };
}

export type DilutionInterpretation =
  | "concentrate_plus_water"
  | "concentrate_in_final_solution";

export interface ExactRatio {
  numerator: bigint;
  denominator: bigint;
}

export interface ConcentrateInput {
  packageVolumeMilliliters: number;
  packagePriceMinor: number;
  dilutionRatioN: number;
  interpretation: DilutionInterpretation;
  standardContainerVolumeMilliliters: number;
  currentSolutionCostPerLiterMinor?: number | null;
}

export interface ConcentrateResult {
  interpretation: DilutionInterpretation;
  interpretationLabel: string;
  totalSolutionVolumeMilliliters: number;
  totalSolutionLiters: ExactRatio;
  costPerLiterMinor: ExactRatio;
  costPerTenLitersMinor: ExactRatio;
  standardContainerCount: ExactRatio;
  fullStandardContainers: number;
  remainderMilliliters: number;
  savingsPerLiterMinor: ExactRatio | null;
  savingsForTotalVolumeMinor: ExactRatio | null;
  savingsPercent: ExactRatio | null;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

export function exactRatio(numerator: bigint, denominator: bigint): ExactRatio {
  if (denominator === 0n) throw new RangeError("Знаменатель не может быть равен нулю");
  const normalizedNumerator = denominator < 0n ? -numerator : numerator;
  const normalizedDenominator = denominator < 0n ? -denominator : denominator;
  const divisor = greatestCommonDivisor(normalizedNumerator, normalizedDenominator) || 1n;
  return {
    numerator: normalizedNumerator / divisor,
    denominator: normalizedDenominator / divisor,
  };
}

export function roundExactRatio(value: ExactRatio): bigint {
  return roundRatio(value.numerator, value.denominator);
}

export function calculateConcentrate(input: ConcentrateInput): ConcentrateResult {
  assertSafeInteger(input.packageVolumeMilliliters, "Объём упаковки", 1);
  assertSafeInteger(input.packagePriceMinor, "Цена упаковки");
  assertSafeInteger(input.dilutionRatioN, "Пропорция разбавления", 1);
  assertSafeInteger(input.standardContainerVolumeMilliliters, "Объём ёмкости", 1);
  if (input.currentSolutionCostPerLiterMinor != null) {
    assertSafeInteger(input.currentSolutionCostPerLiterMinor, "Текущая стоимость литра");
  }

  const multiplier = input.interpretation === "concentrate_plus_water"
    ? input.dilutionRatioN + 1
    : input.dilutionRatioN;
  const totalSolutionVolumeMilliliters = toSafeNumber(
    BigInt(input.packageVolumeMilliliters) * BigInt(multiplier),
    "Общий объём рабочего раствора",
  );
  const price = BigInt(input.packagePriceMinor);
  const totalVolume = BigInt(totalSolutionVolumeMilliliters);
  const costPerLiterMinor = exactRatio(price * 1_000n, totalVolume);
  const costPerTenLitersMinor = exactRatio(price * 10_000n, totalVolume);
  const standardContainerCount = exactRatio(
    totalVolume,
    BigInt(input.standardContainerVolumeMilliliters),
  );

  let savingsPerLiterMinor: ExactRatio | null = null;
  let savingsForTotalVolumeMinor: ExactRatio | null = null;
  let savingsPercent: ExactRatio | null = null;
  if (input.currentSolutionCostPerLiterMinor != null) {
    const current = BigInt(input.currentSolutionCostPerLiterMinor);
    savingsPerLiterMinor = exactRatio(
      current * costPerLiterMinor.denominator - costPerLiterMinor.numerator,
      costPerLiterMinor.denominator,
    );
    savingsForTotalVolumeMinor = exactRatio(
      current * totalVolume - price * 1_000n,
      1_000n,
    );
    if (current > 0n) {
      savingsPercent = exactRatio(
        savingsPerLiterMinor.numerator,
        savingsPerLiterMinor.denominator * current,
      );
    }
  }

  return {
    interpretation: input.interpretation,
    interpretationLabel:
      input.interpretation === "concentrate_plus_water"
        ? `1 часть концентрата + ${input.dilutionRatioN} частей воды`
        : `1 часть концентрата в ${input.dilutionRatioN} частях готового раствора`,
    totalSolutionVolumeMilliliters,
    totalSolutionLiters: exactRatio(totalVolume, 1_000n),
    costPerLiterMinor,
    costPerTenLitersMinor,
    standardContainerCount,
    fullStandardContainers: Math.floor(
      totalSolutionVolumeMilliliters / input.standardContainerVolumeMilliliters,
    ),
    remainderMilliliters:
      totalSolutionVolumeMilliliters % input.standardContainerVolumeMilliliters,
    savingsPerLiterMinor,
    savingsForTotalVolumeMinor,
    savingsPercent,
  };
}

function normalizeDecimalInput(value: string): string {
  return value.trim().replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
}

/** Parses a non-negative decimal string into a fixed-scale integer without Number/float math. */
export function parseScaledDecimal(value: string, scaleDigits: number): number {
  assertSafeInteger(scaleDigits, "Точность");
  const normalized = normalizeDecimalInput(value);
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) throw new TypeError("Введите неотрицательное число");
  const fraction = match[2] ?? "";
  if (fraction.length > scaleDigits) {
    throw new RangeError(`Допустимо не более ${scaleDigits} знаков после запятой`);
  }
  const scaled = BigInt(match[1]) * 10n ** BigInt(scaleDigits) +
    BigInt(fraction.padEnd(scaleDigits, "0") || "0");
  return toSafeNumber(scaled, "Числовое значение");
}

export const parseKztToMinor = (value: string) => parseScaledDecimal(value, 2);
export const parsePercentToBps = (value: string) => parseScaledDecimal(value, 2);
export const parseQuantityToMilli = (value: string) => parseScaledDecimal(value, 3);

export function formatMoneyMinor(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor)) throw new RangeError("Некорректная денежная сумма");
  return new Intl.NumberFormat("ru-KZ", {
    style: "currency",
    currency: "KZT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountMinor / MINOR_UNITS_PER_KZT);
}

export function formatExactMoney(value: ExactRatio): string {
  return formatMoneyMinor(toSafeNumber(roundExactRatio(value), "Отображаемая сумма"));
}

export function formatBasisPoints(basisPoints: number | null): string {
  if (basisPoints === null) return "—";
  if (!Number.isSafeInteger(basisPoints)) throw new RangeError("Некорректный процент");
  return `${new Intl.NumberFormat("ru-KZ", { maximumFractionDigits: 2 }).format(basisPoints / 100)}%`;
}

export function formatExactRatio(value: ExactRatio, maximumFractionDigits = 3): string {
  assertSafeInteger(maximumFractionDigits, "Число знаков");
  const scale = 10n ** BigInt(maximumFractionDigits);
  const scaled = roundRatio(value.numerator * scale, value.denominator);
  const negative = scaled < 0n;
  const absolute = negative ? -scaled : scaled;
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(maximumFractionDigits, "0").replace(/0+$/, "");
  const raw = `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
  return raw.replace(".", ",");
}

export function formatMinorForInput(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor)) throw new RangeError("Некорректная денежная сумма");
  const negative = amountMinor < 0;
  const absolute = Math.abs(amountMinor);
  const whole = Math.floor(absolute / MINOR_UNITS_PER_KZT);
  const fraction = String(absolute % MINOR_UNITS_PER_KZT).padStart(2, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function formatBpsForInput(basisPoints: number): string {
  return formatMinorForInput(basisPoints);
}

export function formatMilliForInput(valueMilli: number): string {
  assertSafeInteger(valueMilli, "Количество");
  const whole = Math.floor(valueMilli / QUANTITY_SCALE);
  const fraction = String(valueMilli % QUANTITY_SCALE).padStart(3, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
}
