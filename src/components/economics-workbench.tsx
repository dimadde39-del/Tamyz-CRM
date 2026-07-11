"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Plus,
  Save,
  Scale,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ChangeEvent, type MouseEvent } from "react";

import {
  saveEconomicsScenarioAction,
  type EconomicsSaveActionState,
  type EconomicsSavePayload,
} from "@/app/economics/actions";
import { CopyButton } from "@/components/copy-button";
import { Badge, MetricCard, Panel } from "@/components/ui";
import type {
  EconomicsSnapshotLine,
  SavedEconomicsSnapshot,
} from "@/db/economics-scenario-service";
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
  formatMoneyMinor,
  parseKztToMinor,
  parsePercentToBps,
  parseQuantityToMilli,
  type EconomicsScenarioResult,
} from "@/lib/economics-engine";
import type { Owner } from "@/lib/domain";

export interface EconomicsClientOption {
  id: number;
  name: string;
  owner: Owner;
  basket: Array<{
    id: number;
    product: string;
    brand: string | null;
    sku: string | null;
    packaging: string | null;
    canisterQuantity: number | null;
    currentPrice: string | null;
    delivery: string | null;
  }>;
}

export interface EconomicsSupplierOption {
  id: number;
  name: string;
  sourceCommission: string | null;
  sourceRepeatCommission: string | null;
  sourceMoq: string | null;
  sourceDelivery: string | null;
  qualifiedMoq: string | null;
}

export interface EconomicsRegistrationOption {
  id: number;
  clientId: number;
  supplierId: number;
  status: string;
  requestedCommissionPercent: string;
  confirmedCommissionPercent: string | null;
  requestedRepeatCommissionMonths: number;
  confirmedRepeatCommissionMonths: number | null;
  commissionPaymentBusinessDays: number;
  supplierResponseText: string | null;
}

export interface EconomicsTestBasketOption {
  id: number;
  supplierId: number;
  name: string;
  dealerAmountMinor: number;
  clientAmountMinor: number;
  itemNames: string[];
}

export interface SavedScenarioOption {
  id: number;
  updatedAt: string;
  snapshot: SavedEconomicsSnapshot;
  result: EconomicsScenarioResult;
}

export interface EconomicsWorkbenchProps {
  clients: EconomicsClientOption[];
  suppliers: EconomicsSupplierOption[];
  registrations: EconomicsRegistrationOption[];
  testBaskets: EconomicsTestBasketOption[];
  savedScenarios: SavedScenarioOption[];
  initialScenario: { id: number; snapshot: SavedEconomicsSnapshot } | null;
  copiedFromScenarioId: number | null;
  initialClientId: number | null;
  initialTestBasketId: number | null;
}

type DraftLine = Omit<
  EconomicsSnapshotLine,
  "quantityMilli" | "dealerUnitPriceMinor" | "clientUnitPriceMinor"
> & {
  quantity: string;
  dealerUnitPrice: string;
  clientUnitPrice: string;
};

interface ScenarioDraft {
  scenarioId: number | null;
  copiedFromScenarioId: number | null;
  testBasketId: number | null;
  title: string;
  actor: Owner;
  clientId: string;
  supplierId: string;
  termsStatus: "draft" | "confirmed";
  earningMode: "referral_commission" | "dealer_spread" | "fixed_fee";
  discountPercent: string;
  commissionPercent: string;
  fixedFee: string;
  minimumOrder: string;
  delivery: string;
  deliveryPayer: "supplier" | "client" | "tamyz";
  otherDirectExpenses: string;
  repeatOrdersPerMonth: string;
  repeatCommissionMonths: string;
  commissionPaymentBusinessDays: string;
  lines: DraftLine[];
}

interface ConcentrateDraft {
  packageVolumeLiters: string;
  packagePrice: string;
  dilutionRatioN: string;
  interpretation: "concentrate_plus_water" | "concentrate_in_final_solution";
  standardContainerLiters: string;
  currentSolutionCostPerLiter: string;
}

const MODE_LABELS = {
  referral_commission: "Комиссия поставщика",
  dealer_spread: "Дилерская разница",
  fixed_fee: "Фиксированная выплата",
} as const;

const DELIVERY_LABELS = {
  supplier: "поставщик",
  client: "клиент",
  tamyz: "TAMYZ",
} as const;

function blankLine(index = 1): DraftLine {
  return {
    key: `new-${index}`,
    name: "",
    quantity: "1",
    dealerUnitPrice: "",
    clientUnitPrice: "",
  };
}

function snapshotLineToDraft(line: EconomicsSnapshotLine): DraftLine {
  return {
    key: line.key,
    name: line.name,
    quantity: formatMilliForInput(line.quantityMilli),
    dealerUnitPrice: formatMinorForInput(line.dealerUnitPriceMinor),
    clientUnitPrice: formatMinorForInput(line.clientUnitPriceMinor),
    sourceClientBasketItemId: line.sourceClientBasketItemId ?? null,
    sourceTestBasketItemId: line.sourceTestBasketItemId ?? null,
    brand: line.brand ?? null,
    sku: line.sku ?? null,
    packaging: line.packaging ?? null,
  };
}

function clientBasketLines(client: EconomicsClientOption | undefined): DraftLine[] {
  if (!client || client.basket.length === 0) return [blankLine()];
  return client.basket.map((item) => ({
    key: `client-basket-${item.id}`,
    name: item.product,
    quantity: item.canisterQuantity === null ? "" : String(item.canisterQuantity),
    dealerUnitPrice: "",
    clientUnitPrice: "",
    sourceClientBasketItemId: item.id,
    brand: item.brand,
    sku: item.sku,
    packaging: item.packaging,
  }));
}

function createInitialDraft(props: EconomicsWorkbenchProps): ScenarioDraft {
  const source = props.initialScenario?.snapshot;
  if (source) {
    const isCopy = props.copiedFromScenarioId !== null;
    return {
      scenarioId: isCopy ? null : props.initialScenario?.id ?? null,
      copiedFromScenarioId: isCopy ? props.copiedFromScenarioId : source.copiedFromScenarioId,
      testBasketId: source.sourceTestBasket?.id ?? null,
      title: isCopy ? `Копия — ${source.title}` : source.title,
      actor:
        props.clients.find((client) => client.id === source.client.id)?.owner ?? "Ерасыл",
      clientId: String(source.client.id),
      supplierId: String(source.supplier.id),
      termsStatus: source.input.termsStatus,
      earningMode: source.input.earningMode,
      discountPercent: formatBpsForInput(source.input.discountBps),
      commissionPercent: formatBpsForInput(source.input.commissionBps),
      fixedFee: formatMinorForInput(source.input.fixedFeeMinor),
      minimumOrder: formatMinorForInput(source.input.minimumOrderMinor),
      delivery: formatMinorForInput(source.input.deliveryMinor),
      deliveryPayer: source.input.deliveryPayer,
      otherDirectExpenses: formatMinorForInput(source.input.otherDirectExpensesMinor),
      repeatOrdersPerMonth: formatMilliForInput(source.input.repeatOrdersPerMonthMilli),
      repeatCommissionMonths: String(source.input.repeatCommissionMonths),
      commissionPaymentBusinessDays: String(source.input.commissionPaymentBusinessDays ?? 0),
      lines: source.input.lines.map(snapshotLineToDraft),
    };
  }

  const testBasket = props.testBaskets.find((basket) => basket.id === props.initialTestBasketId);
  const client = props.clients.find((item) => item.id === props.initialClientId);
  if (testBasket) {
    return {
      scenarioId: null,
      copiedFromScenarioId: null,
      testBasketId: testBasket.id,
      title: testBasket.name,
      actor: client?.owner ?? "Димаш",
      clientId: client ? String(client.id) : "",
      supplierId: String(testBasket.supplierId),
      termsStatus: "draft",
      earningMode: "dealer_spread",
      discountPercent: "0",
      commissionPercent: "0",
      fixedFee: "0",
      minimumOrder: "0",
      delivery: "0",
      deliveryPayer: "supplier",
      otherDirectExpenses: "0",
      repeatOrdersPerMonth: "0",
      repeatCommissionMonths: "0",
      commissionPaymentBusinessDays: "0",
      lines: [
        {
          key: `test-basket-${testBasket.id}`,
          name: `${testBasket.name} · ${testBasket.itemNames.length} поз.`,
          quantity: "1",
          dealerUnitPrice: formatMinorForInput(testBasket.dealerAmountMinor),
          clientUnitPrice: formatMinorForInput(testBasket.clientAmountMinor),
        },
      ],
    };
  }

  return {
    scenarioId: null,
    copiedFromScenarioId: null,
    testBasketId: null,
    title: client ? `Экономика корзины — ${client.name}` : "Новый сценарий",
    actor: client?.owner ?? "Ерасыл",
    clientId: client ? String(client.id) : "",
    supplierId: "",
    termsStatus: "draft",
    earningMode: "referral_commission",
    discountPercent: "0",
    commissionPercent: "0",
    fixedFee: "0",
    minimumOrder: "0",
    delivery: "0",
    deliveryPayer: "supplier",
    otherDirectExpenses: "0",
    repeatOrdersPerMonth: "0",
    repeatCommissionMonths: "0",
    commissionPaymentBusinessDays: "0",
    lines: clientBasketLines(client),
  };
}

function parseOptionalMoney(value: string): number {
  return value.trim() ? parseKztToMinor(value) : 0;
}

function parseRequiredMoney(value: string, label: string): number {
  if (!value.trim()) throw new TypeError(`${label}: укажите точное значение, включая 0`);
  return parseKztToMinor(value);
}

function parseOptionalPercent(value: string): number {
  return value.trim() ? parsePercentToBps(value) : 0;
}

function parseRequiredPercent(value: string, label: string): number {
  if (!value.trim()) throw new TypeError(`${label}: укажите точное значение, включая 0`);
  return parsePercentToBps(value);
}

function parseRequiredQuantity(value: string, label: string): number {
  if (!value.trim()) throw new TypeError(`${label}: укажите точное значение, включая 0`);
  return parseQuantityToMilli(value);
}

function parseNonNegativeInteger(value: string, label: string): number {
  if (!/^\d+$/.test(value.trim())) throw new TypeError(`${label}: введите целое число`);
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new RangeError(`${label}: число слишком велико`);
  return result;
}

function buildEngineInput(draft: ScenarioDraft): EconomicsSavePayload["input"] {
  const lines = draft.lines.map((line, index): EconomicsSnapshotLine => {
    if (!line.name.trim()) throw new TypeError(`Позиция ${index + 1}: укажите название`);
    if (!line.quantity.trim()) {
      throw new TypeError(`Позиция ${index + 1}: укажите точное количество`);
    }
    return {
      key: line.key,
      name: line.name.trim(),
      quantityMilli: parseQuantityToMilli(line.quantity),
      dealerUnitPriceMinor: parseRequiredMoney(
        line.dealerUnitPrice,
        `Позиция ${index + 1}, дилерская цена`,
      ),
      clientUnitPriceMinor: parseRequiredMoney(
        line.clientUnitPrice,
        `Позиция ${index + 1}, цена клиенту`,
      ),
      sourceClientBasketItemId: line.sourceClientBasketItemId ?? null,
      sourceTestBasketItemId: line.sourceTestBasketItemId ?? null,
      brand: line.brand ?? null,
      sku: line.sku ?? null,
      packaging: line.packaging ?? null,
    };
  });
  return {
    lines,
    earningMode: draft.earningMode,
    discountBps: parseRequiredPercent(draft.discountPercent, "Скидка"),
    commissionBps:
      draft.earningMode === "referral_commission" && !draft.commissionPercent.trim()
        ? (() => { throw new TypeError("Комиссия: укажите точное значение, включая 0"); })()
        : parseOptionalPercent(draft.commissionPercent),
    fixedFeeMinor:
      draft.earningMode === "fixed_fee" && !draft.fixedFee.trim()
        ? (() => { throw new TypeError("Фиксированная выплата: укажите точное значение, включая 0"); })()
        : parseOptionalMoney(draft.fixedFee),
    minimumOrderMinor: parseRequiredMoney(draft.minimumOrder, "Минимальная сумма заказа"),
    deliveryMinor: parseRequiredMoney(draft.delivery, "Стоимость доставки"),
    deliveryPayer: draft.deliveryPayer,
    otherDirectExpensesMinor: parseRequiredMoney(
      draft.otherDirectExpenses,
      "Другие прямые расходы TAMYZ",
    ),
    repeatOrdersPerMonthMilli: parseRequiredQuantity(
      draft.repeatOrdersPerMonth,
      "Повторные заказы в месяц",
    ),
    repeatCommissionMonths: parseNonNegativeInteger(
      draft.repeatCommissionMonths,
      "Срок повторного вознаграждения",
    ),
    commissionPaymentBusinessDays: parseNonNegativeInteger(
      draft.commissionPaymentBusinessDays,
      "Срок выплаты",
    ),
    termsStatus: draft.termsStatus,
  };
}

function buildSummary(
  draft: ScenarioDraft,
  result: EconomicsScenarioResult,
  clientName: string,
  supplierName: string,
): string {
  const scenarioLines = result.scenarios
    .map((scenario) => `Сценарий ${scenario.months} мес.: ${formatMoneyMinor(scenario.incomeBeforeTaxMinor)}`)
    .join("\n");
  return [
    `TAMYZ · ${draft.title}`,
    `Условия: ${draft.termsStatus === "confirmed" ? "подтверждены поставщиком" : "предварительные"}`,
    `Клиент: ${clientName}`,
    `Поставщик: ${supplierName}`,
    `Режим: ${MODE_LABELS[draft.earningMode]}`,
    `Итоговый счёт клиенту: ${formatMoneyMinor(result.finalClientInvoiceMinor)}`,
    `Валовый доход TAMYZ: ${formatMoneyMinor(result.grossIncomeMinor)}`,
    `Прямые расходы TAMYZ: ${formatMoneyMinor(result.directExpensesMinor)}`,
    `Доход до налогов с заказа: ${formatMoneyMinor(result.netIncomeBeforeTaxMinor)}`,
    `Эффективная маржа: ${result.effectiveMarginBps === null ? "не рассчитывается" : formatBasisPoints(result.effectiveMarginBps)}`,
    scenarioLines,
    "Это сценарий, не прогноз и не гарантия. Налоги не рассчитаны.",
  ].join("\n");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-KZ", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function basketFingerprint(snapshot: SavedEconomicsSnapshot): string {
  return JSON.stringify({
    clientId: snapshot.client.id,
    lines: snapshot.input.lines.map((line) => ({
      sourceClientBasketItemId: line.sourceClientBasketItemId ?? null,
      name: line.name.trim().toLocaleLowerCase("ru"),
      sku: line.sku?.trim().toLocaleLowerCase("ru") ?? null,
      quantityMilli: line.quantityMilli,
    })),
  });
}

export function EconomicsWorkbench(props: EconomicsWorkbenchProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<ScenarioDraft>(() => createInitialDraft(props));
  const [saveState, setSaveState] = useState<EconomicsSaveActionState | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [selectedComparisonIds, setSelectedComparisonIds] = useState<number[]>([]);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [concentrate, setConcentrate] = useState<ConcentrateDraft>({
    packageVolumeLiters: "",
    packagePrice: "",
    dilutionRatioN: "100",
    interpretation: "concentrate_plus_water",
    standardContainerLiters: "10",
    currentSolutionCostPerLiter: "",
  });

  const calculation = useMemo(() => {
    try {
      const input = buildEngineInput(draft);
      return { input, result: calculateEconomics(input), error: null };
    } catch (error) {
      return {
        input: null,
        result: null,
        error: error instanceof Error ? error.message : "Не удалось рассчитать сценарий",
      };
    }
  }, [draft]);

  const concentrateCalculation = useMemo(() => {
    if (!concentrate.packageVolumeLiters.trim() || !concentrate.packagePrice.trim()) {
      return { result: null, error: null };
    }
    try {
      const result = calculateConcentrate({
        packageVolumeMilliliters: parseQuantityToMilli(concentrate.packageVolumeLiters),
        packagePriceMinor: parseKztToMinor(concentrate.packagePrice),
        dilutionRatioN: parseNonNegativeInteger(concentrate.dilutionRatioN, "Пропорция"),
        interpretation: concentrate.interpretation,
        standardContainerVolumeMilliliters: parseQuantityToMilli(
          concentrate.standardContainerLiters,
        ),
        currentSolutionCostPerLiterMinor: concentrate.currentSolutionCostPerLiter.trim()
          ? parseKztToMinor(concentrate.currentSolutionCostPerLiter)
          : null,
      });
      return { result, error: null };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : "Не удалось рассчитать концентрат",
      };
    }
  }, [concentrate]);

  const selectedClient = props.clients.find((client) => String(client.id) === draft.clientId);
  const selectedSupplier = props.suppliers.find(
    (supplier) => String(supplier.id) === draft.supplierId,
  );
  const matchingRegistration = props.registrations.find(
    (registration) =>
      String(registration.clientId) === draft.clientId &&
      String(registration.supplierId) === draft.supplierId,
  );
  const selectedComparisons = selectedComparisonIds
    .map((id) => props.savedScenarios.find((scenario) => scenario.id === id))
    .filter((scenario): scenario is SavedScenarioOption => Boolean(scenario));

  function handleDraftChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.currentTarget;
    const invalidatesConfirmation = !["title", "actor", "termsStatus"].includes(name);
    setSaveState(null);
    setDraft((current) => ({
      ...current,
      termsStatus: invalidatesConfirmation ? "draft" : current.termsStatus,
      [name]: value,
    }));
  }

  function handleClientChange(event: ChangeEvent<HTMLSelectElement>) {
    const clientId = event.currentTarget.value;
    const client = props.clients.find((item) => String(item.id) === clientId);
    const validBasketItemIds = new Set(client?.basket.map((item) => item.id) ?? []);
    setSaveState(null);
    setDraft((current) => {
      if (current.clientId === clientId) return current;
      const keepTestBasket = current.testBasketId !== null;
      const attachingFirstClientToTestBasket = keepTestBasket && current.clientId === "";
      return {
        ...current,
        clientId,
        actor: client?.owner ?? current.actor,
        termsStatus: attachingFirstClientToTestBasket ? current.termsStatus : "draft",
        testBasketId: keepTestBasket ? current.testBasketId : null,
        commissionPercent: attachingFirstClientToTestBasket ? current.commissionPercent : "",
        fixedFee: attachingFirstClientToTestBasket ? current.fixedFee : "",
        minimumOrder: attachingFirstClientToTestBasket ? current.minimumOrder : "",
        delivery: attachingFirstClientToTestBasket ? current.delivery : "",
        otherDirectExpenses: attachingFirstClientToTestBasket ? current.otherDirectExpenses : "",
        repeatOrdersPerMonth: attachingFirstClientToTestBasket ? current.repeatOrdersPerMonth : "",
        repeatCommissionMonths: attachingFirstClientToTestBasket ? current.repeatCommissionMonths : "",
        commissionPaymentBusinessDays: attachingFirstClientToTestBasket ? current.commissionPaymentBusinessDays : "",
        lines: keepTestBasket
          ? current.lines.map((line) => ({ ...line, sourceClientBasketItemId: null }))
          : client
            ? clientBasketLines(client)
            : current.lines.map((line) => ({
                ...line,
                dealerUnitPrice: "",
                clientUnitPrice: "",
                sourceClientBasketItemId:
                  line.sourceClientBasketItemId && validBasketItemIds.has(line.sourceClientBasketItemId)
                    ? line.sourceClientBasketItemId
                    : null,
              })),
      };
    });
  }

  function handleSupplierChange(event: ChangeEvent<HTMLSelectElement>) {
    const supplierId = event.currentTarget.value;
    setSaveState(null);
    setDraft((current) => {
      if (current.supplierId === supplierId) return current;
      return {
        ...current,
        supplierId,
        termsStatus: "draft",
        commissionPercent: "",
        fixedFee: "",
        minimumOrder: "",
        delivery: "",
        otherDirectExpenses: "",
        repeatCommissionMonths: "",
        commissionPaymentBusinessDays: "",
        lines: current.lines.map((line) => ({ ...line, dealerUnitPrice: "" })),
        testBasketId: null,
      };
    });
  }

  function handleLineChange(event: ChangeEvent<HTMLInputElement>) {
    const key = event.currentTarget.dataset.lineKey;
    const field = event.currentTarget.dataset.lineField as
      | "name"
      | "quantity"
      | "dealerUnitPrice"
      | "clientUnitPrice";
    if (!key || !field) return;
    const value = event.currentTarget.value;
    setSaveState(null);
    setDraft((current) => ({
      ...current,
      termsStatus: "draft",
      lines: current.lines.map((line) => (line.key === key ? { ...line, [field]: value } : line)),
    }));
  }

  function handleAddLine() {
    setDraft((current) => ({
      ...current,
      termsStatus: "draft",
      testBasketId: null,
      lines: [...current.lines, blankLine(Date.now())],
    }));
  }

  function handleRemoveLine(event: MouseEvent<HTMLButtonElement>) {
    const key = event.currentTarget.dataset.lineKey;
    if (!key) return;
    setDraft((current) => ({
      ...current,
      termsStatus: "draft",
      testBasketId: null,
      lines: current.lines.length === 1
        ? [blankLine(Date.now())]
        : current.lines.filter((line) => line.key !== key),
    }));
  }

  function handleLoadClientBasket() {
    setSaveState(null);
    setDraft((current) => ({
      ...current,
      termsStatus: "draft",
      testBasketId: null,
      lines: clientBasketLines(selectedClient),
    }));
  }

  function handleApplyRegistration() {
    if (!matchingRegistration) return;
    const confirmed =
      matchingRegistration.status === "подтверждён" ||
      matchingRegistration.status === "стороны познакомлены";
    const hasRecordedSupplierTerms = matchingRegistration.confirmedCommissionPercent !== null;
    setDraft((current) => ({
      ...current,
      termsStatus: confirmed ? "confirmed" : "draft",
      earningMode: "referral_commission",
      commissionPercent:
        (confirmed || hasRecordedSupplierTerms
          ? matchingRegistration.confirmedCommissionPercent
          : matchingRegistration.requestedCommissionPercent) ?? "0",
      repeatCommissionMonths: String(
        (confirmed || hasRecordedSupplierTerms
          ? matchingRegistration.confirmedRepeatCommissionMonths
          : matchingRegistration.requestedRepeatCommissionMonths) ?? 0,
      ),
      commissionPaymentBusinessDays: String(matchingRegistration.commissionPaymentBusinessDays),
    }));
  }

  function handleSave() {
    if (!calculation.input || !calculation.result) {
      setSaveState({ ok: false, message: calculation.error ?? "Проверьте исходные данные." });
      return;
    }
    if (!selectedClient || !selectedSupplier) {
      setSaveState({ ok: false, message: "Выберите клиента и поставщика." });
      return;
    }
    const payload: EconomicsSavePayload = {
      scenarioId: draft.scenarioId,
      copiedFromScenarioId: draft.copiedFromScenarioId,
      actor: draft.actor,
      clientId: selectedClient.id,
      supplierId: selectedSupplier.id,
      registrationId: matchingRegistration?.id ?? null,
      testBasketId: draft.testBasketId,
      title: draft.title,
      input: calculation.input,
    };
    startSaving(async () => {
      const state = await saveEconomicsScenarioAction(payload);
      setSaveState(state);
      if (state.ok) {
        setDraft((current) => ({
          ...current,
          scenarioId: state.scenarioId,
          copiedFromScenarioId: null,
        }));
        router.replace(`/economics?scenario=${state.scenarioId}`, { scroll: false });
        router.refresh();
      }
    });
  }

  function handleConcentrateChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.currentTarget;
    setConcentrate((current) => ({ ...current, [name]: value }));
  }

  function handleComparisonChange(event: ChangeEvent<HTMLInputElement>) {
    const id = Number(event.currentTarget.value);
    const checked = event.currentTarget.checked;
    setSelectedComparisonIds((current) => {
      if (checked) {
        const candidate = props.savedScenarios.find((scenario) => scenario.id === id);
        const reference = props.savedScenarios.find((scenario) => scenario.id === current[0]);
        if (
          !candidate ||
          (reference && basketFingerprint(reference.snapshot) !== basketFingerprint(candidate.snapshot))
        ) {
          setComparisonError("Сравнивать можно только варианты одного клиента с одинаковым составом и количеством корзины.");
          return current;
        }
        if (current.length >= 3) {
          setComparisonError("Для сравнения можно выбрать не более трёх вариантов.");
          return current;
        }
        setComparisonError(null);
        return [...current, id];
      }
      setComparisonError(null);
      return current.filter((item) => item !== id);
    });
  }

  const result = calculation.result;
  const summary =
    result && selectedClient && selectedSupplier
      ? buildSummary(draft, result, selectedClient.name, selectedSupplier.name)
      : "";

  return (
    <div data-testid="economics-workbench">
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
        <div className="space-y-4">
          <Panel
            title="Исходные данные"
            description="Точные значения оператора. Текстовые заметки CRM не участвуют в расчёте автоматически."
            actions={draft.termsStatus === "confirmed" ? <Badge tone="success">Условия подтверждены</Badge> : <Badge tone="warning">Предварительно</Badge>}
          >
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="sm:col-span-2">
                <span className="label">Название сценария *</span>
                <input className="field" name="title" value={draft.title} onChange={handleDraftChange} maxLength={300} />
              </label>
              <label>
                <span className="label">Кто фиксирует</span>
                <select className="field" name="actor" value={draft.actor} onChange={handleDraftChange}>
                  <option value="Димаш">Димаш</option>
                  <option value="Ерасыл">Ерасыл</option>
                </select>
              </label>
              <label>
                <span className="label">Клиент *</span>
                <select className="field" name="clientId" value={draft.clientId} onChange={handleClientChange}>
                  <option value="">Выберите клиента</option>
                  {props.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </label>
              <label>
                <span className="label">Поставщик *</span>
                <select className="field" name="supplierId" value={draft.supplierId} onChange={handleSupplierChange}>
                  <option value="">Выберите поставщика</option>
                  {props.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </label>
              <label>
                <span className="label">Статус условий</span>
                <select className="field" name="termsStatus" value={draft.termsStatus} onChange={handleDraftChange}>
                  <option value="draft">Черновик · предварительно</option>
                  <option value="confirmed">Подтверждены поставщиком</option>
                </select>
              </label>
            </div>

            {matchingRegistration ? (
              <div className="mx-4 mb-4 flex flex-col gap-3 rounded border border-[#bccfdf] bg-[var(--info-soft)] p-3 text-[12px] sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-[720]">Найдена регистрация #{matchingRegistration.id} · {matchingRegistration.status}</p>
                  <p className="mt-1 text-[var(--muted)]">Комиссия: {matchingRegistration.confirmedCommissionPercent ?? matchingRegistration.requestedCommissionPercent}% · повторы: {matchingRegistration.confirmedRepeatCommissionMonths ?? matchingRegistration.requestedRepeatCommissionMonths} мес. · выплата: {matchingRegistration.commissionPaymentBusinessDays} раб. дней</p>
                </div>
                <button className="btn shrink-0" type="button" onClick={handleApplyRegistration}>Подставить условия</button>
              </div>
            ) : null}

            {selectedSupplier && [selectedSupplier.sourceCommission, selectedSupplier.sourceRepeatCommission, selectedSupplier.sourceMoq, selectedSupplier.qualifiedMoq, selectedSupplier.sourceDelivery].some(Boolean) ? (
              <details className="mx-4 mb-4 rounded border border-[var(--line)] bg-[#f7f7f3] p-3 text-[12px]">
                <summary className="cursor-pointer font-[700]">Контекст из карточки поставщика · не участвует в расчёте</summary>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div><dt className="label">Комиссия из источника</dt><dd>{selectedSupplier.sourceCommission || "—"}</dd></div>
                  <div><dt className="label">Повторная комиссия</dt><dd>{selectedSupplier.sourceRepeatCommission || "—"}</dd></div>
                  <div><dt className="label">MOQ из источника</dt><dd>{selectedSupplier.sourceMoq || selectedSupplier.qualifiedMoq || "—"}</dd></div>
                  <div><dt className="label">Доставка из источника</dt><dd>{selectedSupplier.sourceDelivery || "—"}</dd></div>
                </dl>
              </details>
            ) : null}
          </Panel>

          <Panel
            title={`Корзина · ${draft.lines.length} поз.`}
            description="Количество — до 3 знаков; цены — KZT, до тиына. Цена из свободного текста клиента не подставляется."
            actions={selectedClient?.basket.length ? <button className="btn" type="button" onClick={handleLoadClientBasket}>Загрузить корзину клиента</button> : null}
          >
            <div className="scrollbar-thin overflow-x-auto">
              <table className="data-table min-w-[880px]">
                <thead><tr><th>Позиция</th><th>Количество</th><th>Дилерская цена / ед.</th><th>Цена клиенту / ед.</th><th aria-label="Действия" /></tr></thead>
                <tbody>
                  {draft.lines.map((line) => (
                    <tr key={line.key}>
                      <td>
                        <input aria-label="Название позиции" className="field min-w-64" data-line-key={line.key} data-line-field="name" value={line.name} onChange={handleLineChange} />
                        {line.sku || line.brand || line.packaging ? <p className="mt-1 text-[11px] text-[var(--muted)]">{[line.brand, line.sku, line.packaging].filter(Boolean).join(" · ")}</p> : null}
                      </td>
                      <td><input aria-label={`Количество: ${line.name || "позиция"}`} className="field w-28" inputMode="decimal" data-line-key={line.key} data-line-field="quantity" value={line.quantity} onChange={handleLineChange} /></td>
                      <td><input aria-label={`Дилерская цена: ${line.name || "позиция"}`} className="field w-40" inputMode="decimal" data-line-key={line.key} data-line-field="dealerUnitPrice" value={line.dealerUnitPrice} onChange={handleLineChange} placeholder="0.00" /></td>
                      <td><input aria-label={`Цена клиенту: ${line.name || "позиция"}`} className="field w-40" inputMode="decimal" data-line-key={line.key} data-line-field="clientUnitPrice" value={line.clientUnitPrice} onChange={handleLineChange} placeholder="0.00" /></td>
                      <td><button aria-label={`Удалить позицию ${line.name || "без названия"}`} className="btn btn-danger min-h-9 px-2.5" type="button" data-line-key={line.key} onClick={handleRemoveLine}><Trash2 aria-hidden="true" size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[var(--line)] p-3"><button className="btn" type="button" onClick={handleAddLine}><Plus aria-hidden="true" size={15} /> Добавить позицию</button></div>
          </Panel>

          <Panel title="Коммерческие условия" description="Выбран только один режим дохода; остальные значения не суммируются. Ноль — явное допущение сценария, а не подтверждение отсутствия условия.">
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="sm:col-span-2 xl:col-span-3">
                <span className="label">Режим заработка *</span>
                <select className="field" name="earningMode" value={draft.earningMode} onChange={handleDraftChange}>
                  <option value="referral_commission">Referral commission · комиссия от товаров</option>
                  <option value="dealer_spread">Dealer spread · клиентская цена минус дилерская</option>
                  <option value="fixed_fee">Fixed fee · фиксированная выплата</option>
                </select>
              </label>
              <label>
                <span className="label">Скидка клиенту, %</span>
                <input className="field" name="discountPercent" inputMode="decimal" value={draft.discountPercent} onChange={handleDraftChange} />
              </label>
              <label>
                <span className="label">Комиссия поставщика, %</span>
                <input className="field" name="commissionPercent" inputMode="decimal" value={draft.commissionPercent} onChange={handleDraftChange} disabled={draft.earningMode !== "referral_commission"} />
              </label>
              <label>
                <span className="label">Фиксированная выплата, ₸</span>
                <input className="field" name="fixedFee" inputMode="decimal" value={draft.fixedFee} onChange={handleDraftChange} disabled={draft.earningMode !== "fixed_fee"} />
              </label>
              <label>
                <span className="label">Минимальная сумма заказа, ₸</span>
                <input className="field" name="minimumOrder" inputMode="decimal" value={draft.minimumOrder} onChange={handleDraftChange} />
              </label>
              <label>
                <span className="label">Стоимость доставки, ₸</span>
                <input className="field" name="delivery" inputMode="decimal" value={draft.delivery} onChange={handleDraftChange} />
              </label>
              <label>
                <span className="label">Кто оплачивает доставку</span>
                <select className="field" name="deliveryPayer" value={draft.deliveryPayer} onChange={handleDraftChange}>
                  <option value="supplier">Поставщик</option>
                  <option value="client">Клиент</option>
                  <option value="tamyz">TAMYZ</option>
                </select>
              </label>
              <label>
                <span className="label">Другие прямые расходы TAMYZ, ₸</span>
                <input className="field" name="otherDirectExpenses" inputMode="decimal" value={draft.otherDirectExpenses} onChange={handleDraftChange} />
              </label>
              <label>
                <span className="label">Повторных заказов в месяц</span>
                <input className="field" name="repeatOrdersPerMonth" inputMode="decimal" value={draft.repeatOrdersPerMonth} onChange={handleDraftChange} />
              </label>
              <label>
                <span className="label">Срок закрепления / повторов, мес.</span>
                <input className="field" name="repeatCommissionMonths" inputMode="numeric" value={draft.repeatCommissionMonths} onChange={handleDraftChange} />
              </label>
              <label>
                <span className="label">Срок выплаты после оплаты, раб. дней</span>
                <input className="field" name="commissionPaymentBusinessDays" inputMode="numeric" value={draft.commissionPaymentBusinessDays} onChange={handleDraftChange} />
              </label>
            </div>
          </Panel>
        </div>

        <div className="space-y-4 2xl:sticky 2xl:top-4 2xl:self-start" data-testid="economics-results">
          <Panel
            title="Результат"
            description="До налогов; не бухгалтерия, не прогноз и не платёжный расчёт."
            actions={result ? (
              result.offerStatus === "offerable" ? <Badge tone="success">Можно предлагать</Badge> : result.offerStatus === "review" ? <Badge tone="warning">Нужна проверка</Badge> : <Badge tone="danger">Предлагать нельзя</Badge>
            ) : <Badge tone="danger">Ошибка ввода</Badge>}
          >
            {calculation.error ? <div className="m-4 rounded border border-[#e5bcb6] bg-[var(--danger-soft)] p-3 text-[13px] text-[#8f382f]" role="alert">{calculation.error}</div> : null}
            {result ? (
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard label="Дилерская корзина" value={formatMoneyMinor(result.dealerBasketMinor)} />
                  <MetricCard label="Корзина для клиента" value={formatMoneyMinor(result.clientBasketMinor)} />
                  <MetricCard label="Скидка" value={formatMoneyMinor(result.discountMinor)} detail={formatBasisPoints(calculation.input?.discountBps ?? 0)} tone="info" />
                  <MetricCard label="Итоговый счёт" value={formatMoneyMinor(result.finalClientInvoiceMinor)} tone="info" />
                  <MetricCard label="Валовый доход TAMYZ" value={formatMoneyMinor(result.grossIncomeMinor)} />
                  <MetricCard label="Прямые расходы TAMYZ" value={formatMoneyMinor(result.directExpensesMinor)} tone={result.directExpensesMinor > 0 ? "warning" : "neutral"} />
                  <MetricCard label="Доход до налогов" value={formatMoneyMinor(result.netIncomeBeforeTaxMinor)} detail="с одного заказа" tone={result.netIncomeBeforeTaxMinor < 0 ? "danger" : "success"} />
                  <MetricCard label="Эффективная маржа" value={result.effectiveMarginBps === null ? "—" : formatBasisPoints(result.effectiveMarginBps)} detail="от итогового счёта" tone={result.effectiveMarginBps !== null && result.effectiveMarginBps < 500 ? "warning" : "success"} />
                </div>

                {result.warnings.length ? <div className="mt-4 space-y-2">{result.warnings.map((warning) => <div key={warning.code} className={`flex gap-2 rounded border p-3 text-[12px] ${warning.severity === "danger" ? "border-[#e5bcb6] bg-[var(--danger-soft)] text-[#8f382f]" : "border-[#e2cc98] bg-[var(--warning-soft)] text-[#795711]"}`} role={warning.severity === "danger" ? "alert" : "note"}><AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={16} /><span>{warning.message}</span></div>)}</div> : <div className="mt-4 flex gap-2 rounded border border-[#b8d1c2] bg-[var(--accent-soft)] p-3 text-[12px] text-[#1e5b43]"><CheckCircle2 aria-hidden="true" size={16} /><span>Блокирующих условий и предупреждений не найдено.</span></div>}

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {result.scenarios.map((scenario) => <div className="rounded border border-[var(--line)] bg-[#f7f7f3] p-3" key={scenario.months}><p className="label">Сценарий на {scenario.months} месяцев</p><p className="text-[19px] font-[760]">{formatMoneyMinor(scenario.incomeBeforeTaxMinor)}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{formatExactRatio(exactRatio(BigInt(scenario.totalOrdersMilli), 1_000n), 3)} заказа · повторы до {scenario.eligibleRepeatMonths} мес.</p></div>)}
                </div>

                <div className="mt-4 rounded border border-[var(--line)] p-3 text-[12px]">
                  <p className="font-[720]">Влияние скидки</p>
                  <dl className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div><dt className="label">Против скидки 0%</dt><dd className="font-[700]">{formatMoneyMinor(result.discountSensitivity.currentVsZeroMinor)}</dd></div>
                    <div><dt className="label">Скидка {formatBasisPoints(result.discountSensitivity.lowerDiscountBps)}</dt><dd>{formatMoneyMinor(result.discountSensitivity.lowerDiscountNetIncomeMinor)} <span className="text-[var(--muted)]">({formatMoneyMinor(result.discountSensitivity.lowerDiscountChangeMinor)})</span></dd></div>
                    <div><dt className="label">Скидка {formatBasisPoints(result.discountSensitivity.higherDiscountBps)}</dt><dd>{formatMoneyMinor(result.discountSensitivity.higherDiscountNetIncomeMinor)} <span className="text-[var(--muted)]">({formatMoneyMinor(result.discountSensitivity.higherDiscountChangeMinor)})</span></dd></div>
                  </dl>
                </div>

                <details className="mt-4 rounded border border-[var(--line)] p-3 text-[12px]">
                  <summary className="cursor-pointer font-[720]">Исходные допущения · {result.assumptions.length}</summary>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[var(--muted)]">{result.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ol>
                </details>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {summary ? <CopyButton value={summary} label="Копировать краткую сводку" /> : null}
                  <button className="btn btn-primary" type="button" onClick={handleSave} disabled={isSaving}><Save aria-hidden="true" size={15} /> {isSaving ? "Сохраняем…" : draft.scenarioId ? "Обновить snapshot" : "Сохранить сценарий"}</button>
                </div>
                {saveState ? <div className={`mt-3 rounded border p-3 text-[12px] ${saveState.ok ? "border-[#b8d1c2] bg-[var(--accent-soft)] text-[#1e5b43]" : "border-[#e5bcb6] bg-[var(--danger-soft)] text-[#8f382f]"}`} role="status">{saveState.message}</div> : null}
              </div>
            ) : null}
          </Panel>
        </div>
      </div>

      <Panel className="mt-4" title="Калькулятор концентрата" description="Стоимость рабочего раствора считается из точной дроби; округление применяется только при отображении." actions={<FlaskConical aria-hidden="true" className="text-[var(--accent)]" size={19} />}>
        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.8fr)]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label><span className="label">Объём упаковки, л *</span><input className="field" name="packageVolumeLiters" inputMode="decimal" value={concentrate.packageVolumeLiters} onChange={handleConcentrateChange} placeholder="5" /></label>
            <label><span className="label">Цена упаковки, ₸ *</span><input className="field" name="packagePrice" inputMode="decimal" value={concentrate.packagePrice} onChange={handleConcentrateChange} placeholder="9856" /></label>
            <label><span className="label">Пропорция 1:N</span><input className="field" name="dilutionRatioN" inputMode="numeric" value={concentrate.dilutionRatioN} onChange={handleConcentrateChange} /></label>
            <label className="sm:col-span-2 xl:col-span-3"><span className="label">Трактовка пропорции *</span><select className="field" name="interpretation" value={concentrate.interpretation} onChange={handleConcentrateChange}><option value="concentrate_plus_water">1 часть концентрата + N частей воды</option><option value="concentrate_in_final_solution">1 часть концентрата в N частях готового раствора</option></select></label>
            <label><span className="label">Стандартная ёмкость, л</span><input className="field" name="standardContainerLiters" inputMode="decimal" value={concentrate.standardContainerLiters} onChange={handleConcentrateChange} /></label>
            <label className="sm:col-span-2"><span className="label">Текущая стоимость 1 л средства клиента, ₸</span><input className="field" name="currentSolutionCostPerLiter" inputMode="decimal" value={concentrate.currentSolutionCostPerLiter} onChange={handleConcentrateChange} placeholder="необязательно" /></label>
          </div>
          <div data-testid="concentrate-results">
            {concentrateCalculation.error ? <div className="rounded border border-[#e5bcb6] bg-[var(--danger-soft)] p-3 text-[13px] text-[#8f382f]" role="alert">{concentrateCalculation.error}</div> : null}
            {concentrateCalculation.result ? (
              <div className="rounded border border-[#bccfdf] bg-[var(--info-soft)] p-4">
                <Badge tone="info">Трактовка: {concentrateCalculation.result.interpretationLabel}</Badge>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                  <div><dt className="label">Рабочий объём</dt><dd className="text-[22px] font-[760]">{formatExactRatio(concentrateCalculation.result.totalSolutionLiters, 3)} л</dd></div>
                  <div><dt className="label">Стандартных ёмкостей</dt><dd className="text-[22px] font-[760]">{formatExactRatio(concentrateCalculation.result.standardContainerCount, 3)}</dd></div>
                  <div><dt className="label">Стоимость 1 литра</dt><dd className="font-[720]">{formatExactMoney(concentrateCalculation.result.costPerLiterMinor)}</dd></div>
                  <div><dt className="label">Стоимость 10 литров</dt><dd className="font-[720]">{formatExactMoney(concentrateCalculation.result.costPerTenLitersMinor)}</dd></div>
                  {concentrateCalculation.result.savingsPerLiterMinor ? <div><dt className="label">Экономия на 1 литре</dt><dd className="font-[720]">{formatExactMoney(concentrateCalculation.result.savingsPerLiterMinor)}</dd></div> : null}
                  {concentrateCalculation.result.savingsForTotalVolumeMinor ? <div><dt className="label">Экономия на всём объёме</dt><dd className="font-[720]">{formatExactMoney(concentrateCalculation.result.savingsForTotalVolumeMinor)}</dd></div> : null}
                  {concentrateCalculation.result.savingsPercent ? <div><dt className="label">Экономия, %</dt><dd className="font-[720]">{formatExactRatio(exactRatio(concentrateCalculation.result.savingsPercent.numerator * 100n, concentrateCalculation.result.savingsPercent.denominator), 2)}%</dd></div> : null}
                  <div><dt className="label">Полные ёмкости / остаток</dt><dd>{concentrateCalculation.result.fullStandardContainers} / {concentrateCalculation.result.remainderMilliliters} мл</dd></div>
                </dl>
              </div>
            ) : <div className="rounded border border-dashed border-[var(--line-strong)] p-6 text-center text-[12px] text-[var(--muted)]">Введите объём и цену упаковки. Расчёт появится без перезагрузки.</div>}
          </div>
        </div>
      </Panel>

      <Panel className="mt-4" title="Сравнение поставщиков" description="Выберите до трёх вариантов одной корзины и клиента. Рейтинга и скрытых весов нет — только числа и обязательные условия." actions={<Scale aria-hidden="true" className="text-[var(--accent)]" size={19} />}>
        <div className="grid gap-4 p-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
            {props.savedScenarios.map((scenario) => {
              const checked = selectedComparisonIds.includes(scenario.id);
              const reference = props.savedScenarios.find((item) => item.id === selectedComparisonIds[0]);
              const compatible = !reference || basketFingerprint(reference.snapshot) === basketFingerprint(scenario.snapshot);
              return <label className={`flex items-start gap-2 rounded border border-[var(--line)] bg-white p-3 ${compatible ? "cursor-pointer" : "cursor-not-allowed opacity-55"}`} key={scenario.id}><input className="mt-1" type="checkbox" value={scenario.id} checked={checked} disabled={!checked && (selectedComparisonIds.length >= 3 || !compatible)} onChange={handleComparisonChange} /><span className="min-w-0"><span className="block truncate font-[700]">{scenario.snapshot.title}</span><span className="mt-1 block text-[11px] text-[var(--muted)]">{scenario.snapshot.supplier.name} · {scenario.snapshot.termsStatus === "confirmed" ? "подтверждено" : "предварительно"}</span>{!compatible ? <span className="mt-1 block text-[10px] text-[var(--danger)]">Другая корзина или клиент</span> : null}<span className="mt-2 flex gap-2"><Link className="underline decoration-black/20 underline-offset-2" href={`/economics?scenario=${scenario.id}`}>Открыть</Link><Link className="underline decoration-black/20 underline-offset-2" href={`/economics?copy=${scenario.id}`}>Создать копию</Link></span></span></label>;
            })}
            {props.savedScenarios.length === 0 ? <p className="rounded border border-dashed border-[var(--line-strong)] p-5 text-center text-[12px] text-[var(--muted)]">Сначала сохраните хотя бы один сценарий.</p> : null}
            {comparisonError ? <p className="rounded border border-[#e5bcb6] bg-[var(--danger-soft)] p-3 text-[11px] text-[#8f382f]" role="alert">{comparisonError}</p> : null}
          </div>
          <div className="scrollbar-thin overflow-x-auto">
            {selectedComparisons.length ? <table className="data-table min-w-[720px]" data-testid="supplier-comparison"><thead><tr><th>Показатель</th>{selectedComparisons.map((scenario) => <th key={scenario.id}>{scenario.snapshot.supplier.name}<p className="mt-1 normal-case tracking-normal text-[10px]">{scenario.snapshot.title}</p></th>)}</tr></thead><tbody>
              <tr><td className="font-[700]">Стоимость для клиента</td>{selectedComparisons.map((scenario) => <td key={scenario.id}>{formatMoneyMinor(scenario.result.finalClientInvoiceMinor)}</td>)}</tr>
              <tr><td className="font-[700]">Доход TAMYZ до налогов</td>{selectedComparisons.map((scenario) => <td key={scenario.id}>{formatMoneyMinor(scenario.result.netIncomeBeforeTaxMinor)}</td>)}</tr>
              <tr><td className="font-[700]">Эффективная маржа</td>{selectedComparisons.map((scenario) => <td key={scenario.id}>{scenario.result.effectiveMarginBps === null ? "—" : formatBasisPoints(scenario.result.effectiveMarginBps)}</td>)}</tr>
              <tr><td className="font-[700]">Минимальный заказ</td>{selectedComparisons.map((scenario) => <td key={scenario.id}>{formatMoneyMinor(scenario.snapshot.input.minimumOrderMinor)}</td>)}</tr>
              <tr><td className="font-[700]">Доставка</td>{selectedComparisons.map((scenario) => <td key={scenario.id}>{formatMoneyMinor(scenario.snapshot.input.deliveryMinor)} · платит {DELIVERY_LABELS[scenario.snapshot.input.deliveryPayer]}</td>)}</tr>
              <tr><td className="font-[700]">Срок выплаты</td>{selectedComparisons.map((scenario) => <td key={scenario.id}>{scenario.snapshot.input.commissionPaymentBusinessDays ?? 0} раб. дней</td>)}</tr>
              <tr><td className="font-[700]">Повторное вознаграждение</td>{selectedComparisons.map((scenario) => <td key={scenario.id}>{scenario.snapshot.input.repeatCommissionMonths} мес.</td>)}</tr>
              <tr><td className="font-[700]">Статус условий</td>{selectedComparisons.map((scenario) => <td key={scenario.id}>{scenario.snapshot.termsStatus === "confirmed" ? <Badge tone="success">Подтверждены</Badge> : <Badge tone="warning">Предварительно</Badge>}</td>)}</tr>
            </tbody></table> : <div className="flex min-h-52 items-center justify-center rounded border border-dashed border-[var(--line-strong)] p-6 text-center text-[12px] text-[var(--muted)]">Отметьте от одного до трёх сценариев слева.</div>}
          </div>
        </div>
      </Panel>

      {props.savedScenarios.length ? <Panel className="mt-4" title={`Сохранённые snapshots · ${props.savedScenarios.length}`} description="Названия и финансовые условия ниже взяты из snapshot, а не из текущих карточек CRM."><div className="scrollbar-thin overflow-x-auto"><table className="data-table min-w-[920px]"><thead><tr><th>Сценарий</th><th>Клиент / поставщик</th><th>Режим</th><th>Счёт</th><th>Доход до налогов</th><th>Изменён</th><th /></tr></thead><tbody>{props.savedScenarios.map((scenario) => <tr key={scenario.id}><td className="font-[700]">{scenario.snapshot.title}<p className="mt-1 text-[11px] text-[var(--muted)]">#{scenario.id} · {scenario.snapshot.termsStatus === "confirmed" ? "подтверждён" : "предварительный"}</p></td><td>{scenario.snapshot.client.name}<p className="mt-1 text-[11px] text-[var(--muted)]">{scenario.snapshot.supplier.name}</p></td><td>{MODE_LABELS[scenario.snapshot.input.earningMode]}</td><td>{formatMoneyMinor(scenario.result.finalClientInvoiceMinor)}</td><td>{formatMoneyMinor(scenario.result.netIncomeBeforeTaxMinor)}</td><td>{formatDate(scenario.updatedAt)}</td><td><div className="flex gap-2"><Link className="btn min-h-8" href={`/economics?scenario=${scenario.id}`}>Открыть</Link><Link className="btn min-h-8" href={`/economics?copy=${scenario.id}`}>Копия</Link></div></td></tr>)}</tbody></table></div></Panel> : null}
    </div>
  );
}
