# MoneyMate AI: Setup Guide

Everything you need to run MoneyMate locally and deploy it to Vercel. Budget about 30 minutes the first time.

## 0. Prerequisites

- Node.js 18.17 or later (Node 20 recommended)
- A GitHub account (for Vercel deploys)
- Free accounts on: Supabase, Resend, Anthropic, Vercel

## 1. Install dependencies

```bash
git clone https://github.com/poojakannanv/money-mate-ai.git
cd money-mate-ai
npm install
```

## 2. Create the Supabase project and database

1. Go to https://supabase.com and create a new project (region: London, eu-west-2, keeps latency low for UK users).
2. Wait for the project to provision, then open **Project Settings, then Database**.
3. Copy the **Transaction pooler** connection string (port 6543). It looks like:
   `postgresql://postgres.abcdefgh:YOUR-PASSWORD@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`
   The app uses the postgres-js driver with `prepare: false`, which is required for this pooler.
4. Run the migration. Two options:
   - **SQL Editor (simplest):** open the Supabase SQL Editor, paste the whole contents of `drizzle/0000_init.sql`, and run it.
   - **Drizzle Kit:** set `DATABASE_URL` in `.env` first, then run `npm run db:migrate`.
5. Verify in **Table Editor** that you can see: `user`, `account`, `session`, `verificationToken`, `transaction`, `insight`.

## 3. Resend (magic-link emails)

1. Sign up at https://resend.com and create an API key.
2. While testing you can send from `onboarding@resend.dev` with no domain setup. Note that in this mode Resend only delivers to the email address you signed up with, which is fine for a solo demo.
3. For a public demo, verify a domain in Resend and use something like `MoneyMate AI <login@yourdomain.co.uk>`.

## 4. AI provider key (free option available)

MoneyMate works with any one of three providers. Pick one:

- **Groq (free tier, recommended for a demo):** create a key at https://console.groq.com/keys and set `GROQ_API_KEY`.
- **Google Gemini (free tier):** create a key at https://aistudio.google.com/apikey and set `GEMINI_API_KEY`.
- **Anthropic Claude (pay as you go):** create a key at https://console.anthropic.com and set `ANTHROPIC_API_KEY`. Needs a credit balance.

If more than one key is set, the order above decides; set `AI_PROVIDER` to force one. Override models with `AI_CHAT_MODEL` and `AI_FAST_MODEL` if a default model id has been retired.

With no key at all the app still runs: built-in merchant rules categorise most UK transactions and the weekly digest is computed from the numbers. Only chat needs a provider.

## 5. Environment variables

```bash
cp .env.example .env
```

Fill in:

| Variable | Value |
|---|---|
| `DATABASE_URL` | The Supabase transaction-pooler URI from step 2 |
| `AUTH_SECRET` | `npx auth secret` or `openssl rand -base64 32` |
| `AUTH_RESEND_KEY` | Your Resend API key |
| `EMAIL_FROM` | e.g. `MoneyMate AI <onboarding@resend.dev>` |
| `GROQ_API_KEY` (or `GEMINI_API_KEY` / `ANTHROPIC_API_KEY`) | Your AI provider key from step 4 |

## 6. Run locally

```bash
npm run dev
```

1. Open http://localhost:3000 and click **Get started free**.
2. Enter your email, click the magic link that arrives, and you land on the dashboard.
3. Go to **Upload** and drop in `sample-data/monzo-sample.csv` (or the Starling or generic file).
4. Confirm the preview, import, and watch the AI categorise everything.
5. Open **Chat** and try: "What are my recurring subscriptions?"

## 7. Deploy to Vercel

1. Push the repo to GitHub.
2. In Vercel, **Add New Project**, import the repo. Framework preset: Next.js (auto-detected).
3. Add all the environment variables from step 5 in **Settings, then Environment Variables** (Production and Preview).
4. Deploy. Vercel builds with `next build` and no extra config is needed.
5. After the first deploy, update Resend to allow your production domain in any link-tracking settings, and set `AUTH_TRUST_HOST=true` only if you deploy somewhere other than Vercel (Vercel is trusted automatically by Auth.js v5).

## 8. Sanity checklist

- [ ] Magic link arrives and signs you in
- [ ] Middleware redirects `/dashboard` to `/login` when signed out
- [ ] Upload of each sample CSV imports and categorises
- [ ] Re-uploading the same file reports 0 new transactions (dedupe works)
- [ ] Dashboard shows totals, pie, 6-month bars and the Weekly Insights card
- [ ] Chat answers "Compare this month's spending to last month" with real numbers

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `DATABASE_URL is not set` at boot | `.env` missing or not loaded; restart `npm run dev` |
| Magic link never arrives | Resend sandbox mode only sends to your own signup address |
| `prepared statement` errors from Postgres | You used the session pooler (port 5432); use the transaction pooler URI (6543) |
| Chat errors or never calls tools | Model id outdated or free-tier rate limit hit; set `AI_CHAT_MODEL` or wait a minute |
| Categorisation slow on big files | Expected: batches of 20 run sequentially; the 2,000 row cap keeps it bounded |
