export type DateRangeKey = "this-month" | "last-month" | "3m" | "all";

export const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "3m", label: "Last 3 months" },
  { key: "all", label: "All time" },
];

export interface DateRange {
  /** Inclusive ISO date, or undefined for open-ended. */
  from?: string;
  /** Inclusive ISO date, or undefined for open-ended. */
  to?: string;
  label: string;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function firstOfMonth(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1));
}

function lastOfMonth(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex + 1, 0));
}

/** Resolve a range key (from the dashboard's segmented control) into dates. */
export function resolveDateRange(key: DateRangeKey, now = new Date()): DateRange {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  switch (key) {
    case "this-month":
      return { from: toIso(firstOfMonth(y, m)), to: toIso(now), label: "This month" };
    case "last-month":
      return {
        from: toIso(firstOfMonth(y, m - 1)),
        to: toIso(lastOfMonth(y, m - 1)),
        label: "Last month",
      };
    case "3m":
      return { from: toIso(firstOfMonth(y, m - 2)), to: toIso(now), label: "Last 3 months" };
    case "all":
      return { label: "All time" };
  }
}

export function parseRangeKey(value: string | undefined): DateRangeKey {
  if (value === "last-month" || value === "3m" || value === "all") return value;
  return "this-month";
}

/** ISO date string N days before today. */
export function daysAgoIso(days: number, now = new Date()): string {
  const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return toIso(d);
}

export function todayIso(now = new Date()): string {
  return toIso(now);
}

/** First and last day of a given month, as ISO strings. Month is 1-12. */
export function monthBounds(year: number, month: number): { from: string; to: string } {
  return {
    from: toIso(firstOfMonth(year, month - 1)),
    to: toIso(lastOfMonth(year, month - 1)),
  };
}
