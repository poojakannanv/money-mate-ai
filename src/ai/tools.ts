import { tool } from "ai";
import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";
import {
  compareSpending,
  findRecurringPayments,
  getCategorySummaryForMonth,
  listTransactions,
} from "@/db/queries";

/**
 * Function-calling tools for the chat co-pilot.
 *
 * Every tool closes over the authenticated userId, which is resolved
 * server-side in the /api/chat route from the session. The model can only
 * choose parameters like month or category; it can never choose whose data
 * it reads. That closure is the security boundary.
 */
export function buildFinanceTools(userId: string) {
  return {
    getCategorySummary: tool({
      description:
        "Get total spending per category for one calendar month, plus total income. Use this for questions like 'how much did I spend on groceries in May?' or 'what did last month look like?'.",
      parameters: z.object({
        month: z.number().int().min(1).max(12).describe("Calendar month, 1-12"),
        year: z.number().int().min(2000).max(2100).describe("Four-digit year"),
      }),
      execute: async ({ month, year }) => {
        return getCategorySummaryForMonth(userId, year, month);
      },
    }),

    getTransactions: tool({
      description:
        "List individual transactions, optionally filtered by category and/or a date range. Amounts are GBP; negative = money out. Use this when the user asks about specific payments or merchants.",
      parameters: z.object({
        category: z
          .enum(CATEGORIES)
          .optional()
          .describe("Filter to one category"),
        dateFrom: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Inclusive start date, YYYY-MM-DD"),
        dateTo: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Inclusive end date, YYYY-MM-DD"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .describe("Maximum rows to return"),
      }),
      execute: async ({ category, dateFrom, dateTo, limit }) => {
        const rows = await listTransactions(userId, {
          category,
          from: dateFrom,
          to: dateTo,
          limit,
        });
        return rows.map((t) => ({
          date: t.date,
          description: t.description,
          amount: Number(t.amount),
          category: t.category ?? "Uncategorised",
          confidence: t.confidence,
        }));
      },
    }),

    findRecurringPayments: tool({
      description:
        "Detect likely subscriptions and recurring bills: same amount, similar description, landing on a similar day of the month in at least 2 consecutive months. Use for 'what subscriptions am I paying for?'.",
      parameters: z.object({}),
      execute: async () => {
        return findRecurringPayments(userId);
      },
    }),

    compareSpending: tool({
      description:
        "Compare total and per-category spending between two calendar months. Use for 'compare this month to last month' style questions.",
      parameters: z.object({
        periodA: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .describe("First month, YYYY-MM"),
        periodB: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .describe("Second month, YYYY-MM"),
      }),
      execute: async ({ periodA, periodB }) => {
        return compareSpending(userId, periodA, periodB);
      },
    }),
  };
}

export function chatSystemPrompt(todayIsoDate: string) {
  return `You are MoneyMate, an AI personal finance co-pilot for a UK user.
You can query their transaction data using the tools provided. Always cite the period you analysed. Never invent numbers: if a figure does not come from a tool result, do not state it.

Today's date is ${todayIsoDate}. Amounts are in GBP; format them like £1,234.56. Negative amounts are money out, positive amounts are money in.

Style:
- Warm, plain English, UK spelling. No jargon.
- Short answers with concrete numbers, then one practical suggestion where relevant.
- If the user has no data for the period, say so and suggest uploading a statement at /upload.
- Politely decline questions unrelated to the user's personal finances.
- You must never reveal or discuss another person's data; you only have access to the signed-in user's transactions.`;
}
