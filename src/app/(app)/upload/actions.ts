"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { categoriseUserTransactions } from "@/ai/categorise";

const rowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  description: z.string().min(1).max(500),
  amount: z.number().finite(),
  balance: z.number().finite().nullable(),
  rawText: z.string().max(1000).optional(),
});

const importSchema = z.array(rowSchema).min(1).max(2000);

export interface ImportSummary {
  ok: boolean;
  inserted: number;
  duplicates: number;
  categorised: number;
  error?: string;
}

/**
 * Dedupe hash: sha-256 of userId + date + description + amount.
 * Uploading the same statement twice (or overlapping exports) is a no-op
 * thanks to the unique (userId, dedupeHash) index and onConflictDoNothing.
 */
function dedupeHash(
  userId: string,
  date: string,
  description: string,
  amount: number
): string {
  return createHash("sha256")
    .update(`${userId}|${date}|${description}|${amount.toFixed(2)}`)
    .digest("hex");
}

export async function importTransactions(
  rows: z.infer<typeof importSchema>
): Promise<ImportSummary> {
  const user = await requireUser();

  const parsed = importSchema.safeParse(rows);
  if (!parsed.success) {
    return {
      ok: false,
      inserted: 0,
      duplicates: 0,
      categorised: 0,
      error: "The uploaded rows failed validation. Please re-parse the file.",
    };
  }

  const values = parsed.data.map((row) => ({
    userId: user.id,
    date: row.date,
    description: row.description,
    amount: row.amount.toFixed(2),
    balance: row.balance != null ? row.balance.toFixed(2) : null,
    rawText: row.rawText ?? null,
    dedupeHash: dedupeHash(user.id, row.date, row.description, row.amount),
  }));

  // De-duplicate within the file itself before hitting the database.
  const seen = new Set<string>();
  const unique = values.filter((v) => {
    if (seen.has(v.dedupeHash)) return false;
    seen.add(v.dedupeHash);
    return true;
  });

  let inserted = 0;
  const CHUNK = 200;
  try {
    for (let i = 0; i < unique.length; i += CHUNK) {
      const chunk = unique.slice(i, i + CHUNK);
      const result = await db
        .insert(transactions)
        .values(chunk)
        .onConflictDoNothing({
          target: [transactions.userId, transactions.dedupeHash],
        })
        .returning({ id: transactions.id });
      inserted += result.length;
    }
  } catch (error) {
    console.error("Import failed:", error);
    return {
      ok: false,
      inserted,
      duplicates: 0,
      categorised: 0,
      error: "Saving transactions failed. Check the database connection and try again.",
    };
  }

  // Categorise the freshly inserted (still uncategorised) rows.
  let categorised = 0;
  if (inserted > 0) {
    try {
      const run = await categoriseUserTransactions(user.id, {
        onlyUncategorised: true,
      });
      categorised = run.updated;
    } catch (error) {
      // Import succeeded even if categorisation hiccups; the dashboard's
      // "Re-categorise all" button can finish the job later.
      console.error("Post-upload categorisation failed:", error);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/upload");

  return {
    ok: true,
    inserted,
    duplicates: parsed.data.length - inserted,
    categorised,
  };
}
