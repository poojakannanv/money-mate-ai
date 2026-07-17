import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/* ------------------------------------------------------------------ */
/* Auth.js tables (shape required by @auth/drizzle-adapter)            */
/* ------------------------------------------------------------------ */

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compositePk: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

/* ------------------------------------------------------------------ */
/* MoneyMate domain tables                                             */
/* ------------------------------------------------------------------ */

export const transactions = pgTable(
  "transaction",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** ISO date string, YYYY-MM-DD */
    date: date("date", { mode: "string" }).notNull(),
    description: text("description").notNull(),
    /** Negative = money out, positive = money in. Stored as numeric(12,2). */
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    /** Running balance after the transaction, if the bank export includes it. */
    balance: numeric("balance", { precision: 12, scale: 2 }),
    /** One of the CATEGORIES enum in src/lib/categories.ts. Null = not yet categorised. */
    category: text("category"),
    /** Model confidence, 0 to 1. */
    confidence: real("confidence"),
    /** One-line explanation from the model for why this category was chosen. */
    reasoning: text("reasoning"),
    /** The original CSV row, kept for audit and re-categorisation. */
    rawText: text("rawText"),
    /** sha-256 of userId + date + description + amount, for idempotent imports. */
    dedupeHash: text("dedupeHash").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    userDedupeUnique: uniqueIndex("transaction_user_dedupe_idx").on(
      t.userId,
      t.dedupeHash
    ),
    userDateIdx: index("transaction_user_date_idx").on(t.userId, t.date),
  })
);

export const insights = pgTable(
  "insight",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The calendar day this insight was generated for (cache key). */
    forDate: date("forDate", { mode: "string" }).notNull(),
    /** JSON payload: { bullets: string[], action: string } */
    content: text("content").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    userDateUnique: uniqueIndex("insight_user_date_idx").on(t.userId, t.forDate),
  })
);

export type TransactionRow = typeof transactions.$inferSelect;
export type NewTransactionRow = typeof transactions.$inferInsert;
export type InsightRow = typeof insights.$inferSelect;
