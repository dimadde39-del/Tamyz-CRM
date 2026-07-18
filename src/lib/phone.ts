/** A WhatsApp-safe Kazakhstan phone number and its ordinary wa.me link. */
export interface WhatsAppLink {
  number: string;
  url: string;
}

const PHONE_LIST_SEPARATOR = /[,;\n/]+/;

/**
 * Separates source phone lists without changing the values that are stored or displayed.
 * A slash is supported because it is frequently used as a contact separator in source files.
 */
export function splitPhoneNumbers(value: string | null | undefined): string[] {
  if (!value) return [];

  return value
    .split(PHONE_LIST_SEPARATOR)
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

/**
 * Converts a confidently recognised Kazakhstan number to the 11 digits required by wa.me.
 * The original source value remains untouched; this is only for links and other derived UI.
 */
export function normalizePhoneNumber(value: string | null | undefined): string | null {
  for (const candidate of splitPhoneNumbers(value)) {
    const digits = candidate.replace(/\D/g, "");

    if (/^8\d{10}$/.test(digits)) return `7${digits.slice(1)}`;
    if (/^7\d{10}$/.test(digits)) return digits;
    if (/^7\d{9}$/.test(digits)) return `7${digits}`;
  }

  return null;
}

/** Returns every distinct, confidently normalised Kazakhstan number from one or more fields. */
export function normalizePhoneNumbers(...values: Array<string | null | undefined>): string[] {
  const numbers: string[] = [];

  for (const value of values) {
    for (const candidate of splitPhoneNumbers(value)) {
      const number = normalizePhoneNumber(candidate);
      if (number && !numbers.includes(number)) numbers.push(number);
    }
  }

  return numbers;
}

/** Creates normal wa.me links without prefilled text or automatic sending. */
export function buildWhatsAppLinks(...values: Array<string | null | undefined>): WhatsAppLink[] {
  return normalizePhoneNumbers(...values).map((number) => ({
    number,
    url: `https://wa.me/${number}`,
  }));
}

/** Convenience form for interfaces that show only the first valid contact. */
export function buildWhatsAppUrl(...values: Array<string | null | undefined>): string | null {
  return buildWhatsAppLinks(...values)[0]?.url ?? null;
}
