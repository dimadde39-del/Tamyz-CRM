import { describe, expect, it } from "vitest";

import {
  buildWhatsAppLinks,
  buildWhatsAppUrl,
  normalizePhoneNumber,
  normalizePhoneNumbers,
} from "@/lib/phone";

describe("Kazakhstan phone normalisation", () => {
  it.each([
    ["+7 771 191 99 92", "77711919992"],
    ["8 (771) 191-99-92", "77711919992"],
    ["87711919992", "77711919992"],
    ["77711919992", "77711919992"],
    ["7711919992", "77711919992"],
    ["", null],
    ["77119", null],
  ])("normalises %j to %j", (value, expected) => {
    expect(normalizePhoneNumber(value)).toBe(expected);
  });

  it("uses the first valid number and supports commas, semicolons, line breaks, and slashes", () => {
    const contacts = "короткий; +7 771 191 99 92, 8 (701) 942-18-04 /\n7711919992";

    expect(normalizePhoneNumber(contacts)).toBe("77711919992");
    expect(normalizePhoneNumbers(contacts)).toEqual(["77711919992", "77019421804"]);
    expect(buildWhatsAppLinks(contacts)).toEqual([
      { number: "77711919992", url: "https://wa.me/77711919992" },
      { number: "77019421804", url: "https://wa.me/77019421804" },
    ]);
    expect(buildWhatsAppUrl(contacts)).toBe("https://wa.me/77711919992");
  });
});
