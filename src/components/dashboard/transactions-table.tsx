import { AlertTriangle } from "lucide-react";
import type { TransactionRow } from "@/db/schema";
import { CategoryBadge } from "@/components/category-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatGBP } from "@/lib/format";
import { cn } from "@/lib/utils";

interface TransactionsTableProps {
  transactions: TransactionRow[];
  /** Ids flagged as unusual spend, rendered with a warning marker. */
  unusualIds?: Set<string>;
}

export function TransactionsTable({
  transactions,
  unusualIds,
}: TransactionsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((t) => {
          const amount = Number(t.amount);
          const unusual = unusualIds?.has(t.id) ?? false;
          return (
            <TableRow key={t.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDate(t.date)}
              </TableCell>
              <TableCell className="max-w-[280px]">
                <div className="flex items-center gap-2">
                  {unusual ? (
                    <span title="Unusually large for this category">
                      <AlertTriangle
                        className="h-4 w-4 shrink-0 text-amber-500"
                        aria-label="Unusual spend"
                      />
                    </span>
                  ) : null}
                  <span className="truncate" title={t.reasoning ?? undefined}>
                    {t.description}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <CategoryBadge category={t.category} confidence={t.confidence} />
              </TableCell>
              <TableCell
                className={cn(
                  "whitespace-nowrap text-right tabular-nums",
                  amount > 0 && "font-medium text-primary"
                )}
              >
                {formatGBP(amount)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
