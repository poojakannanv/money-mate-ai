const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

const gbpWhole = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

/** Format a number as GBP, e.g. 1234.5 -> "£1,234.50" */
export function formatGBP(value: number): string {
  return gbp.format(value);
}

/** Format a number as GBP without pence, e.g. 1234.5 -> "£1,235" */
export function formatGBPWhole(value: number): string {
  return gbpWhole.format(value);
}

/** Format an ISO date string (YYYY-MM-DD) as "16 May 2026". */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Format a YYYY-MM month key as "May 2026". */
export function formatMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Format a confidence value (0 to 1) as a percentage string. */
export function formatConfidence(confidence: number | null): string {
  if (confidence == null) return "";
  return `${Math.round(confidence * 100)}%`;
}
