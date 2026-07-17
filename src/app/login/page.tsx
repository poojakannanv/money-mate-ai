import Link from "next/link";
import { redirect } from "next/navigation";
import { PiggyBank } from "lucide-react";
import { auth } from "@/auth";
import { signInWithEmail } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Sign in" };

const ERROR_MESSAGES: Record<string, string> = {
  Verification:
    "That magic link has expired or was already used. Request a new one below.",
  Configuration:
    "Sign-in is not configured correctly. Check AUTH_SECRET, AUTH_RESEND_KEY and EMAIL_FROM.",
  Default: "Sign-in failed. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  const errorMessage = searchParams.error
    ? ERROR_MESSAGES[searchParams.error] ?? ERROR_MESSAGES.Default
    : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <PiggyBank className="h-6 w-6 text-primary" aria-hidden />
        MoneyMate AI
      </Link>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Enter your email and we will send you a magic link. No password
            needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage ? (
            <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
          <form action={signInWithEmail} className="flex flex-col gap-3">
            <Input
              type="email"
              name="email"
              placeholder="you@example.co.uk"
              required
              autoComplete="email"
              aria-label="Email address"
            />
            <input
              type="hidden"
              name="callbackUrl"
              value={searchParams.callbackUrl ?? "/dashboard"}
            />
            <Button type="submit" className="w-full">
              Email me a magic link
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            First time here? The same link signs you up.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
