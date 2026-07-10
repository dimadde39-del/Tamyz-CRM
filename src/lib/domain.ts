export const OWNERS = ["Димаш", "Ерасыл"] as const;

export type Owner = (typeof OWNERS)[number];

export const SUPPLIER_STATUSES = [
  "не начато",
  "сообщение отправлено",
  "автоответ",
  "передали менеджеру",
  "регион свободен",
  "регион закрыт",
  "обсуждение условий",
  "квалифицирован",
  "отказ",
  "follow-up",
  "закрыт",
] as const;

export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> =
  Object.fromEntries(SUPPLIER_STATUSES.map((status) => [status, status])) as Record<
    SupplierStatus,
    string
  >;

export const CLIENT_STATUSES = [
  "не активирован",
  "к контакту",
  "контакт установлен",
  "интерес",
  "отказ",
  "follow-up",
  "закрыт",
] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const PRIORITIES = ["высокий", "средний", "низкий"] as const;

export type Priority = (typeof PRIORITIES)[number];

export const TRI_STATE_VALUES = ["unknown", "yes", "no"] as const;

export type TriState = (typeof TRI_STATE_VALUES)[number];

export const TRI_STATE_LABELS: Record<TriState, string> = {
  unknown: "неизвестно",
  yes: "да",
  no: "нет",
};

export const QUALIFICATION_RESULTS = ["green", "yellow", "red"] as const;

export type QualificationResult = (typeof QUALIFICATION_RESULTS)[number];

export const QUALIFICATION_RESULT_LABELS: Record<QualificationResult, string> = {
  green: "зелёный",
  yellow: "жёлтый",
  red: "красный",
};

export interface QualificationInput {
  noStockPurchaseRequired?: TriState | null;
  supplierInvoicesClient?: TriState | null;
  supplierDeliversClient?: TriState | null;
  commissionRepeatOrders?: TriState | null;
  clientProtectionConfirmed?: TriState | null;
}

/**
 * Red disqualifiers take precedence over an otherwise complete green result.
 * Unknown values deliberately remain yellow rather than being treated as "no".
 */
export function getQualificationResult(
  qualification: QualificationInput,
): QualificationResult {
  const {
    noStockPurchaseRequired = "unknown",
    supplierInvoicesClient = "unknown",
    supplierDeliversClient = "unknown",
    commissionRepeatOrders = "unknown",
    clientProtectionConfirmed = "unknown",
  } = qualification;

  if (
    noStockPurchaseRequired === "no" ||
    commissionRepeatOrders === "no" ||
    clientProtectionConfirmed === "no"
  ) {
    return "red";
  }

  if (
    supplierInvoicesClient === "yes" &&
    supplierDeliversClient === "yes" &&
    commissionRepeatOrders === "yes" &&
    clientProtectionConfirmed === "yes"
  ) {
    return "green";
  }

  return "yellow";
}

export const FIRST_SUPPLIER_MESSAGE =
  "Здравствуйте. Шымкент у вас уже закрыт действующим B2B-партнёром или регион свободен?\n\n" +
  "Мы собрали локальную базу автомоек, детейлинга и клининговых компаний и сейчас выбираем поставщика для пилота. Если регион свободен — с кем можно обсудить запуск продаж?";

const MISSING_CONTACT_VALUES = new Set([
  "",
  "не найдено",
  "не найден",
  "нет данных",
  "n/a",
  "null",
  "undefined",
  "-",
]);

/** Returns the first usable WhatsApp number, in wa.me's digits-only format. */
export function normalizeWhatsAppNumber(value: string | null | undefined): string | null {
  if (!value || MISSING_CONTACT_VALUES.has(value.trim().toLocaleLowerCase("ru"))) {
    return null;
  }

  for (const candidate of value.split(/[;,\n]/)) {
    let digits = candidate.replace(/\D/g, "");

    if (digits.length === 11 && digits.startsWith("8")) {
      digits = `7${digits.slice(1)}`;
    } else if (digits.length === 10) {
      digits = `7${digits}`;
    }

    if (digits.length >= 7 && digits.length <= 15 && !/^([0])\1+$/.test(digits)) {
      return digits;
    }
  }

  return null;
}

/**
 * Builds a manual WhatsApp deep-link. Callers must pass the WhatsApp field;
 * this helper intentionally never falls back to a general phone number.
 */
export function buildWhatsAppUrl(
  whatsapp: string | null | undefined,
  message = FIRST_SUPPLIER_MESSAGE,
): string | null {
  const number = normalizeWhatsAppNumber(whatsapp);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
}

export const ACTIVITY_TYPES = [
  "message_sent",
  "auto_reply_received",
  "response_received",
  "forwarded_to_manager",
  "status_changed",
  "follow_up_created",
  "details_updated",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];
