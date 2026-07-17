import Link from "next/link";
import { LogOut, PiggyBank } from "lucide-react";
import { requireUser } from "@/lib/session";
import { signOutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { NavLinks } from "@/components/nav-links";
import { SiteFooter } from "@/components/site-footer";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 font-semibold"
            >
              <PiggyBank className="h-6 w-6 text-primary" aria-hidden />
              <span className="hidden sm:inline">MoneyMate AI</span>
            </Link>
            <NavLinks />
          </div>
          <div className="flex items-center gap-3">
            <span
              className="hidden max-w-[180px] truncate text-sm text-muted-foreground md:inline"
              title={user.email ?? undefined}
            >
              {user.email}
            </span>
            <form action={signOutAction}>
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
