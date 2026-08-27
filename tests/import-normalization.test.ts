import { describe, expect, it } from "vitest";

import {
  extractTwoGisFirmId,
  normalizeContactValue,
  normalizeInteger,
  normalizePriority,
  normalizeSourceValue,
  parseBooleanFlag,
  splitMultiValue,
} from "@/lib/import/normalization";

describe("source import normalization", () => {
  it.each([null, undefined, "", "  ", "не найдено", "НЕТ ДАННЫХ", "n/a", "-"])(
    "normalizes missing source value %j to null",
    (value) => {
      expect(normalizeSourceValue(value)).toBeNull();
    },
  );

  it("trims source text while preserving meaningful line breaks", () => {
    expect(normalizeSourceValue("  первая строка\r\nвторая строка  ")).toBe(
      "первая строка\nвторая строка",
    );
  });

  it("reads Excel rich-text and formula-result cell values", () => {
    expect(
      normalizeSourceValue({
        richText: [{ text: "КДС" }, { text: "-Алматы" }],
      }),
    ).toBe("КДС-Алматы");
    expect(normalizeSourceValue({ result: 61 })).toBe("61");
  });

  it("keeps every distinct semicolon/newline-delimited contact in source order", () => {
    const source = "+77019421804; +77273175824\n+77019421804; +77017986340";

    expect(splitMultiValue(source)).toEqual([
      "+77019421804",
      "+77273175824",
      "+77017986340",
    ]);
    expect(normalizeContactValue(source)).toBe(
      "+77019421804; +77273175824; +77017986340",
    );
  });

  it("does not manufacture a contact from a missing-value marker", () => {
    expect(normalizeContactValue("не найдено")).toBeNull();
  });

  it("keeps numeric Excel phone cells as plain digits", () => {
    expect(normalizeContactValue(Number("8.7711919992e10"))).toBe("87711919992");
  });

  it.each([
    ["высокий", "высокий"],
    [" HIGH ", "высокий"],
    ["Средний", "средний"],
    ["low", "низкий"],
  ] as const)("normalizes priority %j to %j", (value, expected) => {
    expect(normalizePriority(value)).toBe(expected);
  });

  it("rejects an unknown priority instead of silently misclassifying it", () => {
    expect(() => normalizePriority("срочный")).toThrow("Неизвестный приоритет");
  });

  it.each([
    [5, 5],
    ["004", 4],
    ["не найдено", null],
    ["abc", null],
  ])("normalizes integer %j to %j", (value, expected) => {
    expect(normalizeInteger(value)).toBe(expected);
  });

  it.each([
    ["да", true],
    ["TRUE", true],
    [1, true],
    ["нет", false],
    ["0", false],
    ["неизвестно", null],
  ])("parses boolean flag %j to %j", (value, expected) => {
    expect(parseBooleanFlag(value)).toBe(expected);
  });
});

describe("source identity extraction", () => {
  it("extracts the canonical 2GIS firm id from a URL list", () => {
    expect(
      extractTwoGisFirmId(
        "https://2gis.kz/shymkent/firm/70000001080095107; https://2gis.kz/shymkent/search/автомойка",
      ),
    ).toBe("70000001080095107");
  });

  it("accepts a bare firm id and rejects unrelated URLs", () => {
    expect(extractTwoGisFirmId("70000001080095107")).toBe("70000001080095107");
    expect(extractTwoGisFirmId("https://example.com/DOSCAR")).toBeNull();
  });

  it("keeps same-name locations distinct by their firm identity", () => {
    const firstDoscar = extractTwoGisFirmId(
      "https://2gis.kz/shymkent/firm/70000001080095107",
    );
    const secondDoscar = extractTwoGisFirmId(
      "https://2gis.kz/shymkent/firm/70000001079666252",
    );

    expect(firstDoscar).not.toBe(secondDoscar);
  });
});
