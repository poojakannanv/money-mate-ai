"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wand2 } from "lucide-react";
import { recategoriseAllAction } from "@/app/(app)/dashboard/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export function RecategoriseButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const run = async () => {
    setPending(true);
    try {
      const summary = await recategoriseAllAction();
      if (summary.ok) {
        toast("Re-categorisation complete", {
          description: `${summary.updated} of ${summary.processed} transactions updated.`,
          variant: "success",
        });
        router.refresh();
      } else {
        toast("Re-categorisation failed", {
          description: summary.error,
          variant: "error",
        });
      }
    } catch {
      toast("Re-categorisation failed", {
        description: "Something went wrong. Please try again.",
        variant: "error",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={run} disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Categorising...
        </>
      ) : (
        <>
          <Wand2 className="h-4 w-4" aria-hidden />
          Re-categorise all
        </>
      )}
    </Button>
  );
}
