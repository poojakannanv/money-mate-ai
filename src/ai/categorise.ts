import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { CATEGORIES } from "@/lib/categories";
import { anthropicClient, extractJson, FAST_MODEL, responseText } from "./models";

/**
 * AI transaction categorisation.
 *
 * Batches of 20 transactions are sent to Claude with a strict instruction to
 * return JSON only. The reply is validated with zod against the category
 * enum; on a parse or validation failure we retry once with an explicit
 * correction message before giving up on that batch.
 */

export const BATCH_SIZE = 20;

const categorisationItemSchema = z.object({
  id: z.string(),
  category: z.enum(CATEGORIES),
  confidence: z.coerce.number().min(0).max(1),
  reasoning: z.string().max(500),
});

const categorisationResponseSchema = z.array(categorisationItemSchema);

export type CategorisationResult = z.infer<typeof categorisationItemSchema>;

interface BatchInput {
  id: string;
  date: string;
  description: string;
  amount: number;
}

const SYSTEM_PROMPT = `You are a transaction categoriser for a UK personal finance app.

You will receive a JSON array of bank transactions from a UK current account.
Assign each transaction exactly one category from this list (use the exact string):

${CATEGORIES.map((c) => `- ${c}`).join("\n")}

UK context that should guide you:
- Tesco, Sainsbury's, Asda, Aldi, Lidl, Morrisons, Waitrose, Co-op, Iceland, Ocado are Groceries.
- TfL, Transport for London, Trainline, National Rail, LNER, Avanti, Northern, Oyster are Transport (Tube and Rail).
- Shell, BP, Esso, Texaco, DVLA, parking, MOT, Kwik Fit are Transport (Car and Fuel).
- British Gas, Octopus Energy, EDF, E.ON, OVO, Scottish Power are Utilities (Energy).
- Thames Water, Severn Trent, United Utilities, Anglian Water are Utilities (Water).
- Any council name with "council tax" or "CTAX" is Council Tax.
- BT, Sky, Virgin Media, EE, O2, Vodafone, Three, giffgaff, TalkTalk are Internet and Mobile.
- Netflix, Spotify, Disney+, Amazon Prime, Apple.com/bill, TV Licence, gym memberships are Subscriptions.
- Boots, Superdrug pharmacy items, NHS prescriptions, dentists, opticians are Health and Pharmacy.
- Greggs, Pret, Nando's, Deliveroo, Just Eat, Uber Eats, pubs, cafes, restaurants are Eating Out.
- Salary, wages, HMRC refunds, benefit payments and other money in are Income.
- Moves to savings pots, ISAs or investment platforms (Vanguard, Moneybox, Trading 212) are Savings and Investments.
- Payments to or from the user's own accounts or named individuals with no goods context are Transfers.
- If genuinely unsure, use Other with low confidence. Never invent a category outside the list.

Respond with ONLY a JSON array, no prose, in this shape:
[{"id": "...", "category": "...", "confidence": 0.95, "reasoning": "one short sentence"}]

Include every input id exactly once. Confidence is a number from 0 to 1.`;

async function callClaudeForBatch(
  batch: BatchInput[],
  correction?: string
): Promise<CategorisationResult[]> {
  const client = anthropicClient();
  const userContent = correction
    ? `${JSON.stringify(batch)}\n\nIMPORTANT: A previous attempt failed validation (${correction}). Respond with ONLY the JSON array described in the system prompt, nothing else.`
    : JSON.stringify(batch);
  const messages: { role: "user"; content: string }[] = [
    { role: "user", content: userContent },
  ];

  const response = await client.messages.create({
    model: FAST_MODEL,
    max_tokens: 4000,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages,
  });

  const raw = extractJson(responseText(response));
  return categorisationResponseSchema.parse(raw);
}

/** Categorise one batch with a single retry on parse/validation failure. */
export async function categoriseBatch(
  batch: BatchInput[]
): Promise<CategorisationResult[]> {
  try {
    return await callClaudeForBatch(batch);
  } catch (firstError) {
    const detail =
      firstError instanceof Error ? firstError.message.slice(0, 300) : "Parse error.";
    return callClaudeForBatch(batch, detail);
  }
}

export interface CategoriseRunSummary {
  processed: number;
  updated: number;
  failedBatches: number;
}

/**
 * Categorise the given user's transactions and persist results.
 * When `onlyUncategorised` is true (the post-upload path) it touches only
 * rows with a null category; the "Re-categorise all" button passes false.
 */
export async function categoriseUserTransactions(
  userId: string,
  { onlyUncategorised = true }: { onlyUncategorised?: boolean } = {}
): Promise<CategoriseRunSummary> {
  const conditions = onlyUncategorised
    ? and(eq(transactions.userId, userId), isNull(transactions.category))
    : eq(transactions.userId, userId);

  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      description: transactions.description,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(conditions);

  let updated = 0;
  let failedBatches = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE);
    const batch: BatchInput[] = slice.map((r) => ({
      id: r.id,
      date: r.date,
      description: r.description,
      amount: Number(r.amount),
    }));

    let results: CategorisationResult[];
    try {
      results = await categoriseBatch(batch);
    } catch (error) {
      console.error("Categorisation batch failed after retry:", error);
      failedBatches += 1;
      continue;
    }

    const validIds = new Set(slice.map((r) => r.id));
    for (const result of results) {
      if (!validIds.has(result.id)) continue; // never trust ids the model invented
      await db
        .update(transactions)
        .set({
          category: result.category,
          confidence: result.confidence,
          reasoning: result.reasoning,
        })
        .where(
          and(eq(transactions.id, result.id), eq(transactions.userId, userId))
        );
      updated += 1;
    }
  }

  return { processed: rows.length, updated, failedBatches };
}

/** Clear categories for specific transactions (used before re-categorising). */
export async function clearCategories(userId: string, ids: string[]) {
  if (ids.length === 0) return;
  await db
    .update(transactions)
    .set({ category: null, confidence: null, reasoning: null })
    .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)));
}
