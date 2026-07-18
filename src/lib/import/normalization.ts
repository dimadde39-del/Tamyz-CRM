import type { Priority } from "../domain";

const NULL_SOURCE_VALUES = new Set([
  "",
  "не найдено",
  "не найден",
  "нет данных",
  "n/a",
  "null",
  "undefined",
  "-",
]);

function objectCellValue(value: object): unknown {
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText
      .map((part) =>
        typeof part === "object" && part !== null && "text" in part ? String(part.text) : "",
      )
      .join("");
  }

  if ("text" in value) {
    return value.text;
  }

  if ("result" in value) {
    return value.result;
  }

  return value.toString();
}

function plainNumberText(value: number): string {
  if (Number.isSafeInteger(value)) return value.toFixed(0);
  return String(value);
}

/** Converts an Excel cell value to trimmed source text without losing semicolon lists. */
export function normalizeSourceValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  let normalized: unknown = value;
  if (value instanceof Date) {
    normalized = value.toISOString();
  } else if (typeof value === "object") {
    normalized = objectCellValue(value);
  }

  const text = (typeof normalized === "number" ? plainNumberText(normalized) : String(normalized))
    .replace(/\r\n/g, "\n")
    .trim();
  return NULL_SOURCE_VALUES.has(text.toLocaleLowerCase("ru")) ? null : text;
}

export function splitMultiValue(value: unknown): string[] {
  const normalized = normalizeSourceValue(value);
  if (!normalized) {
    return [];
  }

  return [...new Set(normalized.split(/[;\n]/).map((part) => part.trim()).filter(Boolean))];
}

/** Keeps every distinct source contact; no phone/identity inference is performed. */
export function normalizeContactValue(value: unknown): string | null {
  const values = splitMultiValue(value);
  return values.length > 0 ? values.join("; ") : null;
}

export function normalizePriority(value: unknown): Priority {
  const normalized = normalizeSourceValue(value)?.toLocaleLowerCase("ru");

  if (normalized === "высокий" || normalized === "high") {
    return "высокий";
  }

  if (normalized === "средний" || normalized === "medium") {
    return "средний";
  }

  if (normalized === "низкий" || normalized === "low") {
    return "низкий";
  }

  throw new Error(`Неизвестный приоритет: ${String(value)}`);
}

export function normalizeInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  const normalized = normalizeSourceValue(value);
  if (!normalized) {
    return null;
  }

  const number = Number.parseInt(normalized, 10);
  return Number.isFinite(number) ? number : null;
}

export function parseBooleanFlag(value: unknown): boolean | null {
  const normalized = normalizeSourceValue(value)?.toLocaleLowerCase("ru");

  if (["да", "yes", "true", "1"].includes(normalized ?? "")) {
    return true;
  }

  if (["нет", "no", "false", "0"].includes(normalized ?? "")) {
    return false;
  }

  return null;
}

export function extractTwoGisFirmId(value: unknown): string | null {
  const normalized = normalizeSourceValue(value);
  if (!normalized) {
    return null;
  }

  const urlMatch = normalized.match(/\/firm\/(\d+)/i);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }

  return /^\d+$/.test(normalized) ? normalized : null;
}

export function normalizeHeader(value: unknown): string {
  return normalizeSourceValue(value)?.toLocaleLowerCase("ru") ?? "";
}

export function requireSourceValue(value: unknown, label: string): string {
  const normalized = normalizeSourceValue(value);
  if (!normalized) {
    throw new Error(`В исходной строке отсутствует обязательное поле «${label}»`);
  }

  return normalized;
}
