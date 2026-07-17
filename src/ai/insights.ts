import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { insights } from "@/db/schema";
import { getRecentTransactions } from "@/db/queries";
import { todayIso } from "@/lib/dates";
import { anthropicClient, extractJson, FAST_MODEL, responseText } from "./models";

/**
 * Weekly Insights: a short AI digest of the last 7 days of transactions.
 * Results are cached per calendar day in the `insight` table so the
 * dashboard only pays for one Claude call per user per day.
 */

const insightSchema = z.object({
  bullets: z.array(z.string().min(1).max(400)).min(1).max(4),
  action: z.string().min(1).max(400),
});

export type WeeklyInsight = z.infer<typeof insightSchema>;

const SYSTEM_PROMPT = `You are MoneyMate, an AI personal finance co-pilot for a UK user.
You will receive the user's bank transactions for the last 7 days as JSON.
Amounts are in GBP; negative means money out, positive means money in.

Write a weekly insight summary:
- Exactly 3 short bullets about their spending patterns this week. Be specific, mention amounts in pounds and category or merchant names. Never invent numbers that are not derivable from the data.
- Then ONE concrete, realistic action they could take this week to save money or improve their finances.

Respond with ONLY JSON in this exact shape, no prose:
{"bullets": ["...", "...", "..."], "action": "..."}`;

async function generateInsight(
  transactionsJson: string,
  correction?: string
): Promise<WeeklyInsight> {
  const client = anthropicClient();
  const userContent = correction
    ? `${transactionsJson}\n\nIMPORTANT: A previous attempt failed validation (${correction}). Respond with ONLY the JSON object in the required shape, nothing else.`
    : transactionsJson;
  const messages: { role: "user"; content: string }[] = [
    { role: "user", content: userContent },
  ];
  const response = await client.messages.create({
    model: FAST_MODEL,
    max_tokens: 1000,
    temperature: 0.3,
    system: SYSTEM_PROMPT,
    messages,
  });
  return insightSchema.parse(extractJson(responseText(response)));
}

export interface WeeklyInsightResult {
  insight: WeeklyInsight;
  generatedOn: string;
  fromCache: boolean;
}

/**
 * Get today's cached insight for the user, generating and storing it if
 * absent. Returns null when there is no recent data to analyse.
 */
export async function getOrCreateWeeklyInsight(
  userId: string
): Promise<WeeklyInsightResult | null> {
  const today = todayIso();

  const [cached] = await db
    .select()
    .from(insights)
    .where(and(eq(insights.userId, userId), eq(insights.forDate, today)))
    .limit(1);

  if (cached) {
    const parsed = insightSchema.safeParse(JSON.parse(cached.content));
    if (parsed.success) {
      return { insight: parsed.data, generatedOn: today, fromCache: true };
    }
  }

  const recent = await getRecentTransactions(userId, 7);
  if (recent.length === 0) return null;

  const payload = JSON.stringify(
    recent.map((t) => ({
      date: t.date,
      description: t.description,
      amount: Number(t.amount),
      category: t.category ?? "Uncategorised",
    }))
  );

  let insight: WeeklyInsight;
  try {
    insight = await generateInsight(payload);
  } catch (firstError) {
    const detail =
      firstError instanceof Error ? firstError.message.slice(0, 200) : "parse error";
    insight = await generateInsight(payload, detail);
  }

  await db
    .insert(insights)
    .values({ userId, forDate: today, content: JSON.stringify(insight) })
    .onConflictDoNothing({ target: [insights.userId, insights.forDate] });

  return { insight, generatedOn: today, fromCache: false };
}
