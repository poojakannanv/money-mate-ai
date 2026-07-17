import Link from "next/link";
import { DATE_RANGE_OPTIONS, type DateRangeKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Server-rendered segmented control. Each option is just a link with a
 * ?range= query param, so the whole dashboard re-renders on the server
 * with fresh data and the URL stays shareable.
 */
export function DateRangeTabs({ active }: { active: DateRangeKey }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
      {DATE_RANGE_OPTIONS.map((option) => (
        <Link
          key={option.key}
          href={`/dashboard?range=${option.key}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
            active === option.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
