import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { CATEGORIES } from "@/lib/categories";
import { generateText } from "ai";
import { aiProvider, extractJson, fastModel } from "./models";
import { categoriseByRules } from "./rules";

/**
 * Hybrid transaction categorisation.
 *
 * 1. Deterministic merchant rules handle well-known UK merchants at no cost.
 * 2. Whatever is left goes to the AI model in batches of 20, with a strict
 *    instruction to return JSON only. The reply is validated with zod
 *    against the category enum; on a parse or validation failure we retry
 *    once with an explicit correction message.
 * 3. If no AI provider is configured, or a batch still fails, those rows get
 *    a low-confidence fallback so the dashboard never shows a blank.
 *
 * Set CATEGORISER=ai to skip step 1 and send every row to the model.
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

async function callModelForBatch(
  batch: BatchInput[],
  correction?: string
): Promise<CategorisationResult[]> {
  const userContent = correction
    ? `${JSON.stringify(batch)}\n\nIMPORTANT: A previous attempt failed validation (${correction}). Respond with ONLY the JSON array described in the system prompt, nothing else.`
    : JSON.stringify(batch);

  const { text } = await generateText({
    model: fastModel(),
    maxTokens: 4000,
    temperature: 0,
    system: SYSTEM_PROMPT,
    prompt: userContent,
  });

  return categorisationResponseSchema.parse(extractJson(text));
}

/** Categorise one batch with a single retry on parse/validation failure. */
export async function categoriseBatch(
  batch: BatchInput[]
): Promise<CategorisationResult[]> {
  try {
    return await callModelForBatch(batch);
  } catch (firstError) {
    const detail =
      firstError instanceof Error ? firstError.message.slice(0, 300) : "Parse error.";
    return callModelForBatch(batch, detail);
  }
}

export interface CategoriseRunSummary {
  processed: number;
  updated: number;
  failedBatches: number;
  /** Rows matched by the deterministic merchant rules. */
  byRules: number;
  /** Rows categorised by the AI model. */
  byAi: number;
  /** Rows given the low-confidence fallback because AI was unavailable. */
  byFallback: number;
}

/** Low-confidence result for rows neither the rules nor the AI could place. */
function fallbackResult(row: BatchInput): CategorisationResult {
  return row.amount > 0
    ? {
        id: row.id,
        category: "Income",
        confidence: 0.4,
        reasoning: "Money in with no matching rule; AI categoriser unavailable.",
      }
    : {
        id: row.id,
        category: "Other",
        confidence: 0.2,
        reasoning: "No merchant rule matched; AI categoriser unavailable.",
      };
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

  const inputs: BatchInput[] = rows.map((r) => ({
    id: r.id,
    date: r.date,
    description: r.description,
    amount: Number(r.amount),
  }));

  const save = async (result: CategorisationResult) => {
    await db
      .update(transactions)
      .set({
        category: result.category,
        confidence: result.confidence,
        reasoning: result.reasoning,
      })
      .where(and(eq(transactions.id, result.id), eq(transactions.userId, userId)));
  };

  let byRules = 0;
  let byAi = 0;
  let byFallback = 0;
  let failedBatches = 0;

  // Step 1: deterministic merchant rules.
  const useRules = process.env.CATEGORISER?.trim().toLowerCase() !== "ai";
  const remaining: BatchInput[] = [];
  for (const row of inputs) {
    const match = useRules ? categoriseByRules(row.description, row.amount) : null;
    if (match) {
      await save({ id: row.id, ...match });
      byRules += 1;
    } else {
      remaining.push(row);
    }
  }

  // Step 2: the AI model for everything the rules could not place.
  const aiAvailable = aiProvider() !== null;
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    const done = new Set<string>();

    if (aiAvailable) {
      try {
        const results = await categoriseBatch(batch);
        const validIds = new Set(batch.map((r) => r.id));
        for (const result of results) {
          // never trust ids the model invented or repeated
          if (!validIds.has(result.id) || done.has(result.id)) continue;
          await save(result);
          done.add(result.id);
          byAi += 1;
        }
      } catch (error) {
        console.error("Categorisation batch failed after retry:", error);
        failedBatches += 1;
      }
    }

    // Step 3: fallback for rows the AI skipped or could not be asked about.
    for (const row of batch) {
      if (done.has(row.id)) continue;
      await save(fallbackResult(row));
      byFallback += 1;
    }
  }

  return {
    processed: rows.length,
    updated: byRules + byAi + byFallback,
    failedBatches,
    byRules,
    byAi,
    byFallback,
  };
}

/** Clear categories for specific transactions (used before re-categorising). */
export async function clearCategories(userId: string, ids: string[]) {
  if (ids.length === 0) return;
  await db
    .update(transactions)
    .set({ category: null, confidence: null, reasoning: null })
    .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)));
}
