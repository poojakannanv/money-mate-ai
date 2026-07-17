import { categoryColour } from "@/lib/categories";
import { formatConfidence } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CategoryBadgeProps {
  category: string | null;
  confidence?: number | null;
  className?: string;
}

/** Category pill coloured from the shared palette, with optional confidence. */
export function CategoryBadge({
  category,
  confidence,
  className,
}: CategoryBadgeProps) {
  const label = category ?? "Uncategorised";
  const colour = category ? categoryColour(category) : "#94a3b8";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className
      )}
      style={{
        borderColor: `${colour}55`,
        backgroundColor: `${colour}1a`,
        color: colour,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: colour }}
        aria-hidden
      />
      {label}
      {confidence != null ? (
        <span className="opacity-70">{formatConfidence(confidence)}</span>
      ) : null}
    </span>
  );
}
