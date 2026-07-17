"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden />
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Sorry about that. Your data is safe. Try again, and if the problem
        keeps happening, check that the database and API keys are configured.
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">Error ref: {error.digest}</p>
      ) : null}
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
