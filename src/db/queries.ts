import { and, desc, eq, gte, isNull, lt, lte, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { transactions, type TransactionRow } from "@/db/schema";
import { NON_SPEND_CATEGORIES } from "@/lib/categories";
import { daysAgoIso, monthBounds } from "@/lib/dates";

/**
 * All queries in this file take an explicit userId and filter on it.
 * That is the privacy contract for the whole app: the AI tools, the
 * dashboard and the upload pipeline all come through here.
 */

const EXCLUDED_FROM_SPEND = [...NON_SPEND_CATEGORIES];

/** "Spend" = money out, excluding transfers and savings movements. */
function spendCondition(userId: string) {
  return and(
    eq(transactions.userId, userId),
    lt(transactions.amount, "0"),
    or(
      isNull(transactions.category),
      notInArray(transactions.category, EXCLUDED_FROM_SPEND)
    )
  );
}

function dateBounds(from?: string, to?: string) {
  const conds = [];
  if (from) conds.push(gte(transactions.date, from));
  if (to) conds.push(lte(transactions.date, to));
  return conds;
}

export async function getSpendTotal(
  userId: string,
  from?: string,
  to?: string
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(abs(${transactions.amount}))::float, 0)`,
    })
    .from(transactions)
    .where(and(spendCondition(userId), ...dateBounds(from, to)));
  return row?.total ?? 0;
}

export interface CategoryTotal {
  category: string;
  total: number;
  count: number;
}

export async function getCategoryTotals(
  userId: string,
  from?: string,
  to?: string
): Promise<CategoryTotal[]> {
  const rows = await db
    .select({
      category: sql<string>`coalesce(${transactions.category}, 'Other')`,
      total: sql<number>`coalesce(sum(abs(${transactions.amount}))::float, 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .where(and(spendCondition(userId), ...dateBounds(from, to)))
    .groupBy(sql`coalesce(${transactions.category}, 'Other')`)
    .orderBy(desc(sql`sum(abs(${transactions.amount}))`));
  return rows;
}

export interface MonthlyCategoryTotal {
  month: string; // YYYY-MM
  category: string;
  total: number;
}

/** Spend per category per month, for roughly the last `monthsBack` months. */
export async function getMonthlySpendByCategory(
  userId: string,
  monthsBack = 6
): Promise<MonthlyCategoryTotal[]> {
  const from = daysAgoIso(monthsBack * 31).slice(0, 7) + "-01";
  const monthExpr = sql<string>`to_char(${transactions.date}, 'YYYY-MM')`;
  const rows = await db
    .select({
      month: monthExpr,
      category: sql<string>`coalesce(${transactions.category}, 'Other')`,
      total: sql<number>`coalesce(sum(abs(${transactions.amount}))::float, 0)`,
    })
    .from(transactions)
    .where(and(spendCondition(userId), gte(transactions.date, from)))
    .groupBy(monthExpr, sql`coalesce(${transactions.category}, 'Other')`)
    .orderBy(monthExpr);
  return rows;
}

export interface UnusualTransaction {
  transaction: TransactionRow;
  categoryMean: number;
  threshold: number;
}

/**
 * Unusual spend = a debit more than 2 standard deviations above the mean
 * absolute spend for its category (statistics computed across the user's
 * full history so a narrow date range does not skew them).
 */
export async function getUnusualTransactions(
  userId: string,
  from?: string,
  to?: string
): Promise<UnusualTransaction[]> {
  const stats = await db
    .select({
      category: sql<string>`coalesce(${transactions.category}, 'Other')`,
      mean: sql<number>`avg(abs(${transactions.amount}))::float`,
      sd: sql<number>`coalesce(stddev_samp(abs(${transactions.amount})), 0)::float`,
      count: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .where(spendCondition(userId))
    .groupBy(sql`coalesce(${transactions.category}, 'Other')`);

  const statsByCategory = new Map(
    stats
      .filter((s) => s.count >= 3 && s.sd > 0)
      .map((s) => [s.category, s])
  );
  if (statsByCategory.size === 0) return [];

  const rows = await db
    .select()
    .from(transactions)
    .where(and(spendCondition(userId), ...dateBounds(from, to)))
    .orderBy(desc(transactions.date));

  const unusual: UnusualTransaction[] = [];
  for (const t of rows) {
    const s = statsByCategory.get(t.category ?? "Other");
    if (!s) continue;
    const threshold = s.mean + 2 * s.sd;
    if (Math.abs(Number(t.amount)) > threshold) {
      unusual.push({ transaction: t, categoryMean: s.mean, threshold });
    }
  }
  return unusual.slice(0, 10);
}

export interface TransactionFilters {
  category?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export async function listTransactions(
  userId: string,
  filters: TransactionFilters = {}
): Promise<TransactionRow[]> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const conds = [eq(transactions.userId, userId), ...dateBounds(filters.from, filters.to)];
  if (filters.category) {
    conds.push(eq(transactions.category, filters.category));
  }
  return db
    .select()
    .from(transactions)
    .where(and(...conds))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit);
}

export async function countTransactions(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(eq(transactions.userId, userId));
  return row?.count ?? 0;
}

/** Category totals for one calendar month. Month is 1-12. */
export async function getCategorySummaryForMonth(
  userId: string,
  year: number,
  month: number
) {
  const { from, to } = monthBounds(year, month);
  const [spend, income] = await Promise.all([
    getCategoryTotals(userId, from, to),
    db
      .select({
        total: sql<number>`coalesce(sum(${transactions.amount})::float, 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, from),
          lte(transactions.date, to),
          sql`${transactions.amount} > 0`
        )
      ),
  ]);
  const totalSpend = spend.reduce((acc, c) => acc + c.total, 0);
  return {
    period: { from, to },
    totalSpend,
    totalIncome: income[0]?.total ?? 0,
    byCategory: spend,
  };
}

export interface RecurringPayment {
  description: string;
  amount: number;
  typicalDayOfMonth: number;
  months: string[];
  occurrences: number;
  likelyCategory: string | null;
}

/**
 * Detect recurring payments: identical amounts with a similar description
 * landing on a similar day of the month in at least 2 consecutive months.
 */
export async function findRecurringPayments(
  userId: string
): Promise<RecurringPayment[]> {
  const from = daysAgoIso(370);
  const rows = await db
    .select({
      date: transactions.date,
      description: transactions.description,
      amount: transactions.amount,
      category: transactions.category,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        lt(transactions.amount, "0"),
        gte(transactions.date, from)
      )
    );

  const groups = new Map<
    string,
    { description: string; amount: number; category: string | null; entries: { month: string; day: number }[] }
  >();

  for (const r of rows) {
    const amount = Math.abs(Number(r.amount));
    const normalised = r.description.toLowerCase().replace(/\s+/g, " ").trim();
    const key = `${normalised}|${amount.toFixed(2)}`;
    const month = r.date.slice(0, 7);
    const day = Number(r.date.slice(8, 10));
    const group = groups.get(key) ?? {
      description: r.description,
      amount,
      category: r.category,
      entries: [],
    };
    group.entries.push({ month, day });
    groups.set(key, group);
  }

  const monthIndex = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return y * 12 + (mo - 1);
  };

  const recurring: RecurringPayment[] = [];
  for (const group of Array.from(groups.values())) {
    const byMonth = new Map<string, number>();
    for (const e of group.entries) {
      if (!byMonth.has(e.month)) byMonth.set(e.month, e.day);
    }
    const months = Array.from(byMonth.keys()).sort();
    if (months.length < 2) continue;

    const hasConsecutive = months.some((m, i) => {
      if (i === 0) return false;
      return monthIndex(m) - monthIndex(months[i - 1]) === 1;
    });
    if (!hasConsecutive) continue;

    const days = months.map((m) => byMonth.get(m)!);
    const spread = Math.max(...days) - Math.min(...days);
    if (spread > 5) continue;

    const typicalDay = days.sort((a, b) => a - b)[Math.floor(days.length / 2)];
    recurring.push({
      description: group.description,
      amount: group.amount,
      typicalDayOfMonth: typicalDay,
      months,
      occurrences: group.entries.length,
      likelyCategory: group.category,
    });
  }

  return recurring.sort((a, b) => b.amount - a.amount).slice(0, 25);
}

export interface SpendingComparison {
  periodA: { month: string; totalSpend: number; byCategory: CategoryTotal[] };
  periodB: { month: string; totalSpend: number; byCategory: CategoryTotal[] };
  deltas: { category: string; a: number; b: number; change: number }[];
  totalChange: number;
}

/** Compare two calendar months, each given as "YYYY-MM". */
export async function compareSpending(
  userId: string,
  monthA: string,
  monthB: string
): Promise<SpendingComparison> {
  const bounds = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return monthBounds(y, mo);
  };
  const a = bounds(monthA);
  const b = bounds(monthB);
  const [catsA, catsB] = await Promise.all([
    getCategoryTotals(userId, a.from, a.to),
    getCategoryTotals(userId, b.from, b.to),
  ]);
  const totalA = catsA.reduce((acc, c) => acc + c.total, 0);
  const totalB = catsB.reduce((acc, c) => acc + c.total, 0);

  const allCategories = new Set([
    ...catsA.map((c) => c.category),
    ...catsB.map((c) => c.category),
  ]);
  const deltas = Array.from(allCategories)
    .map((category) => {
      const va = catsA.find((c) => c.category === category)?.total ?? 0;
      const vb = catsB.find((c) => c.category === category)?.total ?? 0;
      return { category, a: va, b: vb, change: vb - va };
    })
    .sort((x, y) => Math.abs(y.change) - Math.abs(x.change));

  return {
    periodA: { month: monthA, totalSpend: totalA, byCategory: catsA },
    periodB: { month: monthB, totalSpend: totalB, byCategory: catsB },
    deltas,
    totalChange: totalB - totalA,
  };
}

/** Transactions in the last N days, for the weekly insights prompt. */
export async function getRecentTransactions(userId: string, days = 7) {
  return db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.userId, userId), gte(transactions.date, daysAgoIso(days)))
    )
    .orderBy(desc(transactions.date));
}
