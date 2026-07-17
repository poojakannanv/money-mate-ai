import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Lightweight route protection.
 *
 * We deliberately do NOT call `auth()` here: sessions are stored in Postgres
 * (database strategy) and the middleware runs on the Edge runtime, where the
 * postgres-js driver is unavailable. Instead we check for the presence of the
 * Auth.js session cookie and redirect to /login when it is missing. The real,
 * authoritative check happens in the server components and server actions via
 * `requireUser()` (src/lib/session.ts), so a forged cookie gets you nothing.
 */
export function middleware(request: NextRequest) {
  const sessionCookie =
    request.cookies.get("__Secure-authjs.session-token") ??
    request.cookies.get("authjs.session-token");

  if (!sessionCookie?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "callbackUrl",
      request.nextUrl.pathname + request.nextUrl.search
    );
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/upload/:path*", "/chat/:path*"],
};
