"use server";

import { signIn, signOut } from "@/auth";

/**
 * Server action: send a magic link to the given email via Resend.
 * Auth.js redirects to the verifyRequest page (/check-email) on success.
 */
export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");
  await signIn("resend", {
    email,
    redirectTo: callbackUrl.startsWith("/") ? callbackUrl : "/dashboard",
  });
}

/** Server action: sign the current user out and return to the landing page. */
export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
