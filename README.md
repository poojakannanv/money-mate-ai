# MoneyMate AI

**An AI personal finance co-pilot for UK households.**

Upload a bank statement, get every transaction categorised by Claude in seconds, ask your money anything in plain English, and receive a weekly insights digest with one concrete action. Built for the UK cost-of-living squeeze, with categories like Council Tax and Transport (Tube and Rail) that generic finance apps do not have.

Built by Pooja Kannan as a UK web developer portfolio project.

## The Problem

UK households are squeezed. Energy bills, groceries, rent and council tax have all climbed sharply, yet most personal finance apps still expect users to do the hard work themselves: manually categorise transactions, set rigid budgets, and decode their own spending patterns.

Existing apps fall into two camps:

1. **Manual budgeting tools** (YNAB, Money Dashboard) that demand discipline most people do not have spare.
2. **Bank-native insights** (Monzo, Starling) that are locked into one bank and rarely give actionable advice.

Neither talks to you like a human financial adviser would. That is the gap MoneyMate AI fills.

## The Solution

A conversational AI co-pilot that:

- Reads any UK bank's CSV statement (Monzo, Starling and generic formats supported)
- Auto-categorises every transaction with a confidence score and a one-line explanation
- Lets you ask anything in plain English ("How much did I spend on takeaways last month?")
- Generates a weekly insights digest with three observations and one concrete action
- Flags unusual spending (more than 2 standard deviations above your category average)

The key design decision: the AI never invents numbers. Every figure in a chat answer comes from a function call against the user's own rows in Postgres.

## Architecture

```
User uploads CSV (parsed in the browser with Papaparse + bank-format detectors)
      |
      v
Server action: dedupe hash (sha-256 of userId+date+description+amount)
      |         insert with ON CONFLICT DO NOTHING
      v
AI Categoriser (Claude, batches of 20, structured JSON output,
      |         zod-validated against the category enum, one retry)
      v
Postgres (Supabase) via Drizzle ORM: transaction table with
      |         category, confidence, reasoning, rawText
      v
Dashboard (server components) --- Recharts pie + stacked bars,
      |         unusual-spend flags, Weekly Insights (cached per day)
      v
Chat (/api/chat, Vercel AI SDK streamText + tools, maxSteps)
        - getCategorySummary({month, year})
        - getTransactions({category?, dateFrom?, dateTo?, limit})
        - findRecurringPayments()
        - compareSpending({periodA, periodB})
      All tools are closed over the session's userId server-side,
      so the model can never touch another user's data.
```

## Features

| Feature | Where | Notes |
|---|---|---|
| Magic-link auth | `/login` | NextAuth.js v5 + Resend, no passwords |
| CSV upload | `/upload` | Drag and drop, Monzo/Starling/generic detectors, preview before import |
| Duplicate detection | upload server action | sha-256 dedupe hash, unique per user, idempotent re-uploads |
| AI categorisation | automatic after upload | 17 UK-tuned categories, confidence + reasoning stored per row |
| Re-categorise all | dashboard button | Re-runs the whole history through Claude |
| Spending dashboard | `/dashboard` | Monthly total, pie by category, 6-month stacked bars, date range selector |
| Unusual-spend flags | `/dashboard` | > 2 standard deviations above the category mean |
| Weekly Insights | `/dashboard` | Claude digest of the last 7 days, cached per day in the `insight` table |
| Conversational chat | `/chat` | Streaming, function calling, suggested starter questions |

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server components, streaming, the UK job market default |
| Language | TypeScript (strict) | Type safety across AI tool calls and DB queries |
| Styling | Tailwind CSS + hand-rolled shadcn/ui-style components | Fast professional polish, no component library lock-in |
| Auth | NextAuth.js (Auth.js v5) + Resend | Magic-link email, no password headaches |
| Database | Supabase Postgres | Free tier, hosted, simple |
| ORM | Drizzle | TypeScript-first, lighter than Prisma, SQL-shaped |
| AI | Vercel AI SDK with a swappable provider: Groq or Gemini (free tiers) or Anthropic Claude | Function calling, structured output, streaming, no vendor lock-in |
| Charts | Recharts | React-native charting, no extra dependencies |
| CSV | Papaparse | Battle-tested CSV parsing in the browser |
| Hosting | Vercel + Supabase | Free tiers are sufficient for a portfolio deployment |

## Getting started

Short version (full steps in [SETUP.md](./SETUP.md)):

```bash
npm install
cp .env.example .env        # fill in the five variables
# run drizzle/0000_init.sql against your Supabase project
npm run dev
```

Then sign in at `http://localhost:3000/login`, upload a file from `sample-data/`, and open the dashboard.

## Project structure

```
src/
  app/            Routes: landing, login, (app)/dashboard|upload|chat, api/chat, api/auth
  components/     UI primitives (components/ui), dashboard, upload and chat components
  lib/            Formatting, dates, categories, CSV parsing, session helper
  db/             Drizzle schema, client, queries (all user-scoped)
  ai/             Categoriser, weekly insights, chat tools, model config
drizzle/          Hand-checked SQL migration
sample-data/      Three realistic UK bank CSVs for demoing
```

## Docs

- [SETUP.md](./SETUP.md): exact setup and deployment steps
- [WALKTHROUGH.md](./WALKTHROUGH.md): design decisions and interview study notes
- [ROADMAP.md](./ROADMAP.md): the 8-day weekend build plan this was shipped against

## Disclaimer

Demo software, not financial advice. All data stays in the signed-in user's account and is never shared with third parties.
