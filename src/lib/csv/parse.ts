import Papa from "papaparse";

/**
 * CSV statement parsing with per-bank format detectors.
 * Runs entirely in the browser; only the normalised rows are sent to the
 * server action, never the raw file.
 *
 * Supported layouts:
 *  - Monzo full export (Transaction ID, Date, Name, Amount, Money Out/In, ...)
 *  - Starling export (Date, Counter Party, Reference, Amount (GBP), Balance (GBP), ...)
 *  - Generic UK layout (date, description, amount, balance) which also covers
 *    hand-rolled exports from HSBC, Barclays, Lloyds and NatWest once the
 *    headers are renamed.
 */

export type BankFormat = "monzo" | "starling" | "generic";

export interface ParsedTransaction {
  /** ISO date, YYYY-MM-DD */
  date: string;
  description: string;
  /** Negative = money out, positive = money in. */
  amount: number;
  balance: number | null;
  /** The raw CSV row joined for audit trail. */
  rawText: string;
}

export interface ParseResult {
  format: BankFormat;
  rows: ParsedTransaction[];
  skipped: number;
  errors: string[];
}

type CsvRow = Record<string, string>;

function normaliseHeader(h: string): string {
  return h.trim().toLowerCase();
}

/** Parse "16/05/2026", "16/05/2026 12:30", "2026-05-16" or "2026-05-16T12:30" to ISO. */
export function parseUkDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // ISO first: YYYY-MM-DD, optionally with time.
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    if (isValidYmd(+y, +m, +d)) return `${y}-${m}-${d}`;
    return null;
  }

  // UK format: DD/MM/YYYY or DD-MM-YYYY, optionally with time.
  const ukMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ukMatch) {
    const [, d, m, y] = ukMatch;
    if (isValidYmd(+y, +m, +d)) {
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }

  return null;
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Parse "£1,234.56", "-12.30", "(45.00)" into a number, or null. */
export function parseAmount(value: string | undefined): number | null {
  if (value == null) return null;
  let s = value.trim();
  if (!s) return null;
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[£$€,\s]/g, "");
  if (!s || s === "-") return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return negative ? -n : n;
}

export function detectFormat(headers: string[]): BankFormat | null {
  const h = headers.map(normaliseHeader);
  const has = (name: string) => h.includes(name);

  if (has("transaction id") && (has("money out") || has("emoji"))) {
    return "monzo";
  }
  if (has("counter party") && (has("amount (gbp)") || has("amount(gbp)"))) {
    return "starling";
  }
  if (has("date") && has("description") && has("amount")) {
    return "generic";
  }
  return null;
}

function get(row: CsvRow, ...names: string[]): string {
  for (const name of names) {
    for (const key of Object.keys(row)) {
      if (normaliseHeader(key) === normaliseHeader(name)) {
        return row[key] ?? "";
      }
    }
  }
  return "";
}

function rowToRawText(row: CsvRow): string {
  return Object.entries(row)
    .filter(([, v]) => v !== "" && v != null)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" | ")
    .slice(0, 1000);
}

function mapMonzoRow(row: CsvRow): ParsedTransaction | null {
  const date = parseUkDate(get(row, "Date"));
  const name = get(row, "Name") || get(row, "Description");
  const amount = parseAmount(get(row, "Amount"));
  if (!date || !name || amount == null) return null;
  return {
    date,
    description: name.trim(),
    amount,
    balance: null,
    rawText: rowToRawText(row),
  };
}

function mapStarlingRow(row: CsvRow): ParsedTransaction | null {
  const date = parseUkDate(get(row, "Date"));
  const counterParty = get(row, "Counter Party");
  const reference = get(row, "Reference");
  const description = [counterParty, reference]
    .filter(Boolean)
    .join(" - ")
    .trim();
  const amount = parseAmount(get(row, "Amount (GBP)", "Amount(GBP)"));
  const balance = parseAmount(get(row, "Balance (GBP)", "Balance(GBP)"));
  if (!date || !description || amount == null) return null;
  return { date, description, amount, balance, rawText: rowToRawText(row) };
}

function mapGenericRow(row: CsvRow): ParsedTransaction | null {
  const date = parseUkDate(get(row, "date"));
  const description = get(row, "description").trim();
  const amount = parseAmount(get(row, "amount"));
  const balance = parseAmount(get(row, "balance"));
  if (!date || !description || amount == null) return null;
  return { date, description, amount, balance, rawText: rowToRawText(row) };
}

const MAPPERS: Record<BankFormat, (row: CsvRow) => ParsedTransaction | null> = {
  monzo: mapMonzoRow,
  starling: mapStarlingRow,
  generic: mapGenericRow,
};

export const MAX_ROWS = 2000;

/** Parse CSV text into normalised transactions. Throws on unrecognised layout. */
export function parseStatementCsv(csvText: string): ParseResult {
  const parsed = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const errors: string[] = parsed.errors
    .slice(0, 5)
    .map((e) => `Row ${e.row ?? "?"}: ${e.message}`);

  const headers = parsed.meta.fields ?? [];
  const format = detectFormat(headers);
  if (!format) {
    throw new Error(
      "Could not recognise this CSV layout. Expected a Monzo or Starling export, or a generic file with date, description, amount and balance columns."
    );
  }

  const mapper = MAPPERS[format];
  const rows: ParsedTransaction[] = [];
  let skipped = 0;

  for (const raw of parsed.data) {
    if (rows.length >= MAX_ROWS) {
      errors.push(`Import capped at ${MAX_ROWS} rows.`);
      break;
    }
    const mapped = mapper(raw);
    if (mapped) {
      rows.push(mapped);
    } else {
      skipped += 1;
    }
  }

  if (rows.length === 0) {
    throw new Error(
      "The file was recognised but no valid transaction rows were found."
    );
  }

  // Oldest first, so running imports read naturally in the preview.
  rows.sort((a, b) => a.date.localeCompare(b.date));

  return { format, rows, skipped, errors };
}
