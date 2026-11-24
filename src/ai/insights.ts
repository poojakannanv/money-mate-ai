import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { insights } from "@/db/schema";
import { getRecentTransactions } from "@/db/queries";
import { todayIso } from "@/lib/dates";
import { generateText } from "ai";
import { NON_SPEND_CATEGORIES, type Category } from "@/lib/categories";
import { aiProvider, extractJson, fastModel } from "./models";

/**
 * Weekly Insights: a short AI digest of the last 7 days of transactions.
 * Results are cached per calendar day in the `insight` table so the
 * dashboard only makes one model call per user per day.
 *
 * If no AI provider is configured, or the call fails, a digest computed
 * directly from the numbers is shown instead. That fallback is not cached,
 * so the AI version takes over as soon as it is available again.
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
  const userContent = correction
    ? `${transactionsJson}\n\nIMPORTANT: A previous attempt failed validation (${correction}). Respond with ONLY the JSON object in the required shape, nothing else.`
    : transactionsJson;
  const { text } = await generateText({
    model: fastModel(),
    maxTokens: 1500,
    temperature: 0.3,
    system: SYSTEM_PROMPT,
    prompt: userContent,
  });
  return insightSchema.parse(extractJson(text));
}

interface InsightRow {
  description: string;
  amount: number;
  category: string;
}

const gbp = (value: number) =>
  `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A digest computed straight from the data, used when AI is unavailable. */
export function buildRuleBasedInsight(rows: InsightRow[]): WeeklyInsight {
  const spend = rows.filter(
    (r) =>
      r.amount < 0 && !NON_SPEND_CATEGORIES.includes(r.category as Category)
  );
  const total = spend.reduce((sum, r) => sum + Math.abs(r.amount), 0);

  const byCategory = new Map<string, number>();
  for (const r of spend) {
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + Math.abs(r.amount));
  }
  const ranked = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const largest = [...spend].sort((a, b) => a.amount - b.amount)[0];

  const bullets = [
    `You spent ${gbp(total)} across ${spend.length} payment${spend.length === 1 ? "" : "s"} in the last 7 days.`,
  ];
  if (ranked[0]) {
    bullets.push(
      `Your biggest category was ${ranked[0][0]} at ${gbp(ranked[0][1])}${
        ranked[1] ? `, followed by ${ranked[1][0]} at ${gbp(ranked[1][1])}` : ""
      }.`
    );
  }
  if (largest) {
    bullets.push(
      `Your largest single payment was ${gbp(Math.abs(largest.amount))} to ${largest.description}.`
    );
  }

  const action = ranked[0]
    ? `Look through this week's ${ranked[0][0]} payments and pick one you could reduce or skip next week.`
    : "No spending this week. Consider moving any spare money into savings.";

  return { bullets, action };
}

export interface WeeklyInsightResult {
  insight: WeeklyInsight;
  generatedOn: string;
  fromCache: boolean;
  /** "ai" for a model-written digest, "rules" for the computed fallback. */
  source: "ai" | "rules";
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
      return {
        insight: parsed.data,
        generatedOn: today,
        fromCache: true,
        source: "ai",
      };
    }
  }

  const recent = await getRecentTransactions(userId, 7);
  if (recent.length === 0) return null;

  const rows: InsightRow[] = recent.map((t) => ({
    description: t.description,
    amount: Number(t.amount),
    category: t.category ?? "Uncategorised",
  }));
  const fallback = (): WeeklyInsightResult => ({
    insight: buildRuleBasedInsight(rows),
    generatedOn: today,
    fromCache: false,
    source: "rules",
  });

  if (aiProvider() === null) return fallback();

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
    try {
      insight = await generateInsight(payload);
    } catch (firstError) {
      const detail =
        firstError instanceof Error ? firstError.message.slice(0, 200) : "parse error";
      insight = await generateInsight(payload, detail);
    }
  } catch (error) {
    console.error("Weekly insights AI call failed, using computed digest:", error);
    return fallback();
  }

  await db
    .insert(insights)
    .values({ userId, forDate: today, content: JSON.stringify(insight) })
    .onConflictDoNothing({ target: [insights.userId, insights.forDate] });

  return { insight, generatedOn: today, fromCache: false, source: "ai" };
}
