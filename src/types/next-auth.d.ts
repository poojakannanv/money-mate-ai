import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /** The database user id, injected in the session callback in src/auth.ts */
      id: string;
    } & DefaultSession["user"];
  }
}
