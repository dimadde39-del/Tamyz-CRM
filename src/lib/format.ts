import { BUSINESS_TIME_ZONE } from "@/lib/time";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

export function formatDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function firstListedValue(value: string | null | undefined) {
  return value?.split(/[;\n]/).map((item) => item.trim()).find(Boolean) ?? null;
}

export function compactText(value: string | null | undefined, length = 90) {
  if (!value) return "—";
  return value.length > length ? `${value.slice(0, length - 1).trimEnd()}…` : value;
}

export function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
