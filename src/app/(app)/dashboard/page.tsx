import { Suspense } from "react";
import { AlertTriangle, Banknote, Inbox } from "lucide-react";
import { requireUser } from "@/lib/session";
import {
  countTransactions,
  getCategoryTotals,
  getMonthlySpendByCategory,
  getSpendTotal,
  getUnusualTransactions,
  listTransactions,
} from "@/db/queries";
import { parseRangeKey, resolveDateRange } from "@/lib/dates";
import { formatDate, formatGBP, formatMonth } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { CategoryBadge } from "@/components/category-badge";
import { DateRangeTabs } from "@/components/dashboard/date-range-tabs";
import { MonthlyBars, type MonthlyBarDatum } from "@/components/dashboard/monthly-bars";
import { RecategoriseButton } from "@/components/dashboard/recategorise-button";
import { SpendPie } from "@/components/dashboard/spend-pie";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import {
  WeeklyInsights,
  WeeklyInsightsSkeleton,
} from "@/components/dashboard/weekly-insights";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  const user = await requireUser();
  const rangeKey = parseRangeKey(searchParams.range);
  const range = resolveDateRange(rangeKey);

  const total = await countTransactions(user.id);
  if (total === 0) {
    return (
      <div className="container max-w-3xl py-16">
        <h1 className="mb-8 text-2xl font-bold tracking-tight">Dashboard</h1>
        <EmptyState
          icon={Inbox}
          title="No transactions yet"
          description="Upload your first bank statement and MoneyMate will categorise it, chart it and start generating insights."
          actionHref="/upload"
          actionLabel="Upload a statement"
        />
      </div>
    );
  }

  const [spendTotal, categoryTotals, monthly, unusual, recent] =
    await Promise.all([
      getSpendTotal(user.id, range.from, range.to),
      getCategoryTotals(user.id, range.from, range.to),
      getMonthlySpendByCategory(user.id, 6),
      getUnusualTransactions(user.id, range.from, range.to),
      listTransactions(user.id, { from: range.from, to: range.to, limit: 50 }),
    ]);

  const pieData = categoryTotals.map((c) => ({
    name: c.category,
    value: Math.round(c.total * 100) / 100,
  }));

  // Pivot monthly rows into one datum per month with a key per category.
  const monthKeys = Array.from(new Set(monthly.map((m) => m.month))).sort();
  const barCategories = Array.from(new Set(monthly.map((m) => m.category)));
  const barData: MonthlyBarDatum[] = monthKeys.map((month) => {
    const datum: MonthlyBarDatum = { label: formatMonth(month) };
    for (const row of monthly.filter((m) => m.month === month)) {
      datum[row.category] = Math.round(row.total * 100) / 100;
    }
    return datum;
  });

  const unusualIds = new Set(unusual.map((u) => u.transaction.id));
  const topCategory = categoryTotals[0];

  return (
    <div className="container flex flex-col gap-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {range.label}
            {range.from ? ` (${formatDate(range.from)} onwards)` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangeTabs active={rangeKey} />
          <RecategoriseButton />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-primary" aria-hidden />
              Total spend
            </CardTitle>
            <CardDescription>{range.label}, excluding transfers and savings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold tabular-nums tracking-tight">
              {formatGBP(spendTotal)}
            </p>
            {topCategory ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Biggest category:{" "}
                <span className="font-medium text-foreground">
                  {topCategory.category}
                </span>{" "}
                at {formatGBP(topCategory.total)}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Suspense fallback={<WeeklyInsightsSkeleton />}>
            <WeeklyInsights userId={user.id} />
          </Suspense>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spend by category</CardTitle>
            <CardDescription>{range.label}</CardDescription>
          </CardHeader>
          <CardContent>
            <SpendPie data={pieData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Last 6 months by category</CardTitle>
            <CardDescription>Stacked monthly spend</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyBars data={barData} categories={barCategories} />
          </CardContent>
        </Card>
      </div>

      {unusual.length > 0 ? (
        <Card className="border-amber-300/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
              Unusual spending
            </CardTitle>
            <CardDescription>
              Debits more than 2 standard deviations above your average for
              that category.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {unusual.map(({ transaction, categoryMean }) => (
                <li
                  key={transaction.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="whitespace-nowrap text-muted-foreground">
                      {formatDate(transaction.date)}
                    </span>
                    <span className="truncate font-medium">
                      {transaction.description}
                    </span>
                    <CategoryBadge category={transaction.category} />
                  </div>
                  <span className="whitespace-nowrap tabular-nums">
                    {formatGBP(Number(transaction.amount))}{" "}
                    <span className="text-xs text-muted-foreground">
                      (typical {formatGBP(categoryMean)})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>
            Latest {recent.length} in this period. Hover a description to see
            the AI&apos;s reasoning.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing in this period. Try a wider date range.
            </p>
          ) : (
            <TransactionsTable transactions={recent} unusualIds={unusualIds} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
