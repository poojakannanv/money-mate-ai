# MoneyMate AI

Next.js personal finance co-pilot: import transactions (CSV via Papaparse, samples in `sample-data/`), store in Postgres via Drizzle, chat with Claude about your money using the Vercel AI SDK. AI/fintech portfolio project built from public industry knowledge only.

## Stack

Next.js (App Router, `src/`), TypeScript, Tailwind, Drizzle ORM + Postgres, NextAuth (@auth/drizzle-adapter), @ai-sdk/anthropic + @anthropic-ai/sdk, Recharts, Zod.

## Commands

- `npm run dev` / `npm run build` / `npm run lint`
- `npm run db:generate` / `db:migrate` / `db:push` / `db:studio` - Drizzle workflow. Run migrations against a fresh database before first `dev`.

## Environment (.env.local, gitignored, copied between machines manually)

`DATABASE_URL` (Postgres), `ANTHROPIC_API_KEY`, `ANTHROPIC_CHAT_MODEL`, `ANTHROPIC_FAST_MODEL`, `EMAIL_FROM`, plus NextAuth secret. See `SETUP.md` for the full list. Never commit values.

## Conventions

- Conventional commit messages (`feat:`, `fix:`, `docs:`).
- Git author: Pooja Kannan <poojakannanv98@gmail.com>.
- See `ROADMAP.md` for the feature plan and `WALKTHROUGH.md` for a code tour.

## Two-laptop workflow

Repo lives on a work laptop (feature work and commits) and a personal laptop (running and testing). GitHub is the sync point. Always `git pull` before editing and `git push` at the end of every session, even WIP. After pulling a commit that touched `package.json`, run `npm install`; after one that touched `drizzle/`, run `npm run db:migrate`.
