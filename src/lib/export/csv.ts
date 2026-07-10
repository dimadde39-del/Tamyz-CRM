const UTF8_BOM = "\uFEFF";
const RECORD_SEPARATOR = "\r\n";

export type CsvValue =
  | string
  | number
  | bigint
  | boolean
  | Date
  | null
  | undefined;

export interface CsvColumn<Row> {
  header: string;
  value: keyof Row | ((row: Row) => CsvValue);
}

function stringifyCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

/** RFC 4180 field escaping: quote separators/newlines and double embedded quotes. */
export function escapeCsvField(value: CsvValue): string {
  const text = stringifyCsvValue(value);

  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

/** Builds an Excel-friendly UTF-8 CSV with a BOM and CRLF record separators. */
export function toCsv<Row>(rows: readonly Row[], columns: readonly CsvColumn<Row>[]): string {
  const header = columns.map((column) => escapeCsvField(column.header)).join(",");
  const records = rows.map((row) =>
    columns
      .map((column) => {
        const value =
          typeof column.value === "function" ? column.value(row) : row[column.value];

        return escapeCsvField(value as CsvValue);
      })
      .join(","),
  );

  return `${UTF8_BOM}${[header, ...records].join(RECORD_SEPARATOR)}${RECORD_SEPARATOR}`;
}

export function csvDownloadResponse(csv: string, filename: string): Response {
  const encodedFilename = encodeURIComponent(filename);

  return new Response(csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
