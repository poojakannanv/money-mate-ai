"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { categoriseUserTransactions } from "@/ai/categorise";

export interface RecategoriseSummary {
  ok: boolean;
  processed: number;
  updated: number;
  error?: string;
}

/** Re-run AI categorisation across every transaction the user owns. */
export async function recategoriseAllAction(): Promise<RecategoriseSummary> {
  const user = await requireUser();
  try {
    const run = await categoriseUserTransactions(user.id, {
      onlyUncategorised: false,
    });
    revalidatePath("/dashboard");
    return { ok: true, processed: run.processed, updated: run.updated };
  } catch (error) {
    console.error("Re-categorise failed:", error);
    return {
      ok: false,
      processed: 0,
      updated: 0,
      error: "Categorisation failed. Check the Anthropic API key and try again.",
    };
  }
}
