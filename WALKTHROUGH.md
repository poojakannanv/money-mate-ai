# MoneyMate AI: Walkthrough and Interview Notes

Study notes for talking about this project in interviews. Each section covers a design decision, why it was made, and where to find the code.

## 1. Why Next.js App Router and server components

- The dashboard (`src/app/(app)/dashboard/page.tsx`) is an async server component. All five queries (total, category totals, monthly series, unusual spends, transaction list) run on the server in one `Promise.all`, and only rendered HTML plus small chart props cross the network. No client-side data fetching, no loading spinners for the initial paint, no API routes needed for page data.
- Client components are used only where interactivity demands it: the charts (Recharts renders in the browser), the CSV dropzone, the chat panel, the toast system, and the two buttons that call server actions. Every one starts with `"use client"`; everything else is server by default.
- The Weekly Insights card is an async server component wrapped in `<Suspense>` (see the dashboard page), so a slow Claude call streams in later without blocking the rest of the page. That is App Router streaming in one sentence: the page shell renders immediately, the slow subtree arrives when ready.
- Mutations use server actions (`src/app/(app)/upload/actions.ts`, `src/app/(app)/dashboard/actions.ts`) instead of hand-rolled POST endpoints: typed input, automatic CSRF protection, and `revalidatePath` for cache invalidation.

Likely question: "When would you NOT use a server component?" Answer: anything needing browser APIs, event handlers, or stateful hooks; here that is charts, drag-and-drop, and streaming chat.

## 2. Why Drizzle over Prisma

- Drizzle is TypeScript-first with no code generation step and no separate schema language: `src/db/schema.ts` is plain TypeScript, and `$inferSelect` gives row types for free.
- It is much lighter at runtime (no query engine binary), which matters in serverless functions where cold start is the tax you pay on every invocation.
- The query builder stays close to SQL. Look at `src/db/queries.ts`: `stddev_samp`, `to_char` month bucketing, and `ON CONFLICT DO NOTHING` are all expressed directly rather than fought through an abstraction.
- The official `@auth/drizzle-adapter` slots straight into NextAuth v5 (`src/auth.ts`), with the Auth.js tables defined alongside the domain tables in one schema file.
- Trade-off to acknowledge: Prisma has a more mature ecosystem and its studio/migration tooling is friendlier for large teams. For a solo TypeScript project on serverless, Drizzle wins.

## 3. How function calling keeps the AI grounded and user-scoped

This is the heart of the project. Files: `src/ai/tools.ts`, `src/app/api/chat/route.ts`.

- The chat route authenticates first (`auth()` from NextAuth), then calls `buildFinanceTools(session.user.id)`. Every tool `execute` closes over that userId and passes it into queries that filter `WHERE userId = ...` (`src/db/queries.ts`). The model chooses months, categories and limits; it can never choose the user. That closure is the security boundary.
- `streamText` from the Vercel AI SDK runs with `tools` and `maxSteps: 5`, so Claude can chain calls (for example `compareSpending` then `getTransactions`) before answering, and `toDataStreamResponse()` streams the whole thing, tool calls included, to `useChat` on the client.
- Grounding: the system prompt (in `src/ai/tools.ts`) instructs the model to never state figures that did not come from a tool result and to always cite the period analysed. Combined with tools that return the real numbers, this eliminates hallucinated amounts by construction rather than by hope.
- Zod schemas on every tool double as validation and as the JSON schema the model sees, so malformed tool calls are rejected before touching the database.

Likely question: "What stops the model reading another user's data?" Answer: the userId never comes from the model or the request body; it comes from the server-side session, resolved before the model is even invoked.

## 4. Structured output categorisation with validation and retry

File: `src/ai/categorise.ts`.

- Transactions go to Claude in batches of 20 with a system prompt containing the exact 17-category enum plus UK merchant heuristics (TfL is Tube and Rail, Octopus is Energy, CTAX is Council Tax).
- The reply must be a JSON array of `{id, category, confidence, reasoning}`. It is parsed with a fence-tolerant extractor (`extractJson` in `src/ai/models.ts`) and validated with zod against `z.enum(CATEGORIES)`. Any invented category fails validation.
- On failure, exactly one retry is sent with the validation error appended. If that fails too, the batch is skipped and counted; the import still succeeds and "Re-categorise all" can repair it later. AI failure never blocks the data pipeline.
- Defensive detail: returned ids are checked against the batch's real ids, so the model cannot update rows it was not shown.
- Cost control: categorisation and the weekly digest use a Haiku-class model; only the chat co-pilot uses a Sonnet-class model (`src/ai/models.ts`).

## 5. Dedupe strategy

Files: `src/app/(app)/upload/actions.ts`, `src/db/schema.ts`, `drizzle/0000_init.sql`.

- Each row gets `sha256(userId | date | description | amount)` computed server-side. A unique index on `(userId, dedupeHash)` plus `onConflictDoNothing` makes imports idempotent: re-uploading the same statement, or overlapping exports from the same bank, inserts nothing and reports "duplicates skipped".
- Hashing includes userId so two users with identical transactions never collide across accounts, and the unique index is per user.
- Within-file duplicates are also filtered in memory before insert, and `returning({id})` counts what was genuinely inserted so only new rows are sent for categorisation.
- Known trade-off: two genuinely identical transactions on the same day (two identical coffees) collapse into one. Banks solve this with transaction ids; a v2 would include the bank's id in the hash when present (Monzo exports have one).

## 6. Streaming architecture

- `/api/chat` (Node runtime, `maxDuration: 60`) returns `result.toDataStreamResponse()`: an SSE-style data stream carrying text deltas, tool-call events and tool results.
- On the client, `useChat` (from `ai/react`, in `src/components/chat/chat-panel.tsx`) consumes that stream, appending tokens as they arrive and exposing `toolInvocations` per message, which the UI renders as "Fetching transactions..." chips so users see the agent working.
- A typing indicator shows while the request is in flight but no assistant text has streamed yet, which is exactly the window when tool calls are executing.
- The Weekly Insights card is the other streaming story: React Suspense streaming on the server rather than SSE, same principle of never blocking the shell on the slowest dependency.

## 7. Auth and middleware choices

Files: `src/auth.ts`, `src/middleware.ts`, `src/lib/session.ts`.

- NextAuth v5 with the database session strategy and the Resend magic-link provider: no passwords to store, breach, or reset.
- The middleware does a cookie-presence check only and redirects to `/login`. It deliberately does not hit the database, because database sessions cannot be validated on the Edge runtime with postgres-js. The authoritative check is `requireUser()` in every protected server component and server action, so a forged cookie gets a redirect at render time and no data. Fail-fast UX at the edge, real security at the data layer.

## 8. Unusual-spend detection

File: `src/db/queries.ts` (`getUnusualTransactions`).

- Per-category mean and sample standard deviation (`stddev_samp`) computed in Postgres across the user's full history, requiring at least 3 data points and non-zero variance so a category with two rows does not scream outlier.
- A transaction is flagged when its absolute amount exceeds mean + 2 standard deviations. Stats come from full history while flags apply to the selected range, so switching to "this month" does not recompute a misleading baseline.

## 9. Other questions worth preparing

- "How would you scale categorisation for 100k rows?" Queue it (Vercel cron or a worker), run batches concurrently with rate limiting, and cache merchant to category mappings so repeat merchants skip the model entirely.
- "Why store amount as numeric(12,2) and not a float?" Money must not accumulate binary floating point error; numeric is exact, and the app converts to number only at the display and stats layer.
- "Why parse the CSV in the browser?" The raw file never leaves the user's machine; only normalised rows are posted. Smaller payloads, better privacy story.
- "What is the biggest weakness?" Sequential categorisation latency on large uploads, and CSV as an ingestion format at all. The roadmap answer is Open Banking via TrueLayer, which removes uploads entirely.
- "How do you version prompts?" They live in code (`src/ai/*.ts`) and change through pull requests; an eval suite over sample statements is the listed next step for the AI-engineer track.
