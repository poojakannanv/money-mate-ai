import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <Icon className="h-10 w-10 text-muted-foreground" aria-hidden />
      <h3 className="font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref}>
          <Button size="sm" className="mt-1">
            {actionLabel}
          </Button>
        </Link>
      ) : null}
    </div>
  );
}
