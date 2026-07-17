import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Session helper for server components and server actions.
 * Returns the authenticated user (with a guaranteed id) or redirects
 * to /login. Every data access path in the app goes through this.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
  };
}

/** Non-redirecting variant for places that render differently when signed out. */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
  };
}
