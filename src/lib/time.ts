export const BUSINESS_TIME_ZONE = "Asia/Almaty";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: BUSINESS_TIME_ZONE,
  dateStyle: "short",
  timeStyle: "short",
});

export function businessDateKey(date: Date = new Date()) {
  return dateFormatter.format(date);
}

export function formatBusinessDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

export function isDueOnOrBeforeToday(value: string | Date | null | undefined, now: Date = new Date()) {
  if (!value) return false;
  const dateKey = value instanceof Date ? businessDateKey(value) : value.slice(0, 10);
  return dateKey <= businessDateKey(now);
}

export function addHours(value: string | Date, hours: number) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function isOlderThanHours(
  value: string | Date | null | undefined,
  hours: number,
  now: Date = new Date(),
) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < now.getTime() - hours * 60 * 60 * 1000;
}
