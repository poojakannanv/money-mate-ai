import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  providers: [
    Resend({
      // Reads AUTH_RESEND_KEY from the environment automatically.
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/check-email",
  },
  callbacks: {
    session({ session, user }) {
      // Expose the database user id so server code can scope queries.
      session.user.id = user.id;
      return session;
    },
  },
});
