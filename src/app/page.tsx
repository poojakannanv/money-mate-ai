import Link from "next/link";
import {
  ArrowRight,
  MessageSquareText,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SiteFooter } from "@/components/site-footer";
import { getCurrentUser } from "@/lib/session";

export default async function LandingPage() {
  const user = await getCurrentUser();
  const ctaHref = user ? "/dashboard" : "/login";
  const ctaLabel = user ? "Open your dashboard" : "Get started free";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <PiggyBank className="h-6 w-6 text-primary" aria-hidden />
            <span>MoneyMate AI</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href={user ? "/dashboard" : "/login"}>
              <Button size="sm" variant={user ? "default" : "outline"}>
                {user ? "Dashboard" : "Sign in"}
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b bg-gradient-to-b from-accent/60 to-background">
          <div className="container flex flex-col items-center gap-6 py-20 text-center md:py-28">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              Powered by Claude with function calling
            </span>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
              Your AI personal finance co-pilot for UK life
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Upload a bank statement, get every transaction categorised in
              seconds, and ask your money anything in plain English. From
              council tax to takeaways, MoneyMate actually understands UK
              spending.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Link href={ctaHref}>
                <Button size="lg">
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground">
                Magic-link sign in. No passwords, no card details.
              </p>
            </div>
          </div>
        </section>

        {/* Problem statement */}
        <section className="container py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              The cost-of-living squeeze is a data problem
            </h2>
            <p className="mt-4 text-muted-foreground">
              Energy bills, groceries, rent and council tax have all climbed,
              yet most finance apps still expect you to categorise every
              transaction by hand and decode your own spending patterns.
              Manual budgeting tools demand discipline; bank-native insights
              are locked to one bank. Neither talks to you like a human
              financial adviser would. MoneyMate AI fills that gap.
            </p>
          </div>
        </section>

        {/* Feature cards */}
        <section className="border-t bg-muted/40">
          <div className="container grid gap-6 py-16 md:grid-cols-3 md:py-20">
            <Card>
              <CardHeader>
                <UploadCloud className="mb-2 h-8 w-8 text-primary" aria-hidden />
                <CardTitle>Any UK bank, one upload</CardTitle>
                <CardDescription>
                  Drop in a CSV from Monzo, Starling or a generic export.
                  Duplicates are detected automatically, and Claude categorises
                  every transaction with a confidence score and a reason.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <MessageSquareText
                  className="mb-2 h-8 w-8 text-primary"
                  aria-hidden
                />
                <CardTitle>Ask your money anything</CardTitle>
                <CardDescription>
                  &ldquo;How much did I spend on takeaways last month?&rdquo;
                  The chat co-pilot answers by querying your real transactions
                  through function calling, so it never invents numbers.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <ShieldCheck className="mb-2 h-8 w-8 text-primary" aria-hidden />
                <CardTitle>Insights that respect privacy</CardTitle>
                <CardDescription>
                  A weekly AI digest with three insights and one concrete
                  action, unusual-spend flags, and per-user data scoping
                  throughout. Your data is yours, full stop.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <section className="container py-16 text-center md:py-20">
          <Card className="mx-auto max-w-2xl border-primary/30 bg-accent/40">
            <CardHeader>
              <CardTitle className="text-2xl">
                See your money clearly this weekend
              </CardTitle>
              <CardDescription>
                Sign in with a magic link, upload one statement, and ask your
                first question in under two minutes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={ctaHref}>
                <Button size="lg">
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
