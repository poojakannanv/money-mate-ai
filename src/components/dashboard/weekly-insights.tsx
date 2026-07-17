import { Lightbulb, Sparkles } from "lucide-react";
import { getOrCreateWeeklyInsight } from "@/ai/insights";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Async server component. Generates (or reads the daily cache of) the
 * weekly AI digest. Wrapped in <Suspense> by the dashboard so the rest of
 * the page never waits on Claude.
 */
export async function WeeklyInsights({ userId }: { userId: string }) {
  let result: Awaited<ReturnType<typeof getOrCreateWeeklyInsight>> = null;
  let failed = false;
  try {
    result = await getOrCreateWeeklyInsight(userId);
  } catch (error) {
    console.error("Weekly insights failed:", error);
    failed = true;
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          Weekly Insights
        </CardTitle>
        <CardDescription>
          AI digest of your last 7 days, refreshed once a day.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {failed ? (
          <p className="text-sm text-muted-foreground">
            Insights are unavailable right now. They will be back on the next
            visit.
          </p>
        ) : !result ? (
          <p className="text-sm text-muted-foreground">
            No transactions in the last 7 days. Upload a recent statement and
            your weekly digest will appear here.
          </p>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-2 text-sm">
              {result.insight.bullets.map((bullet, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-accent/50 p-3 text-sm">
              <Lightbulb
                className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                aria-hidden
              />
              <p>
                <span className="font-medium">This week: </span>
                {result.insight.action}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function WeeklyInsightsSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          Weekly Insights
        </CardTitle>
        <CardDescription>
          AI digest of your last 7 days, refreshed once a day.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <Skeleton className="h-14 w-full" />
      </CardContent>
    </Card>
  );
}
