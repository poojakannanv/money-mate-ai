import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

/**
 * Reuse a single postgres-js connection across hot reloads in development,
 * otherwise every file save leaks a connection against Supabase's pool.
 * `prepare: false` is required when connecting through Supabase's
 * transaction-mode pooler (PgBouncer), which does not support
 * prepared statements.
 */
const globalForDb = globalThis as unknown as {
  pgConn: ReturnType<typeof postgres> | undefined;
};

const conn =
  globalForDb.pgConn ?? postgres(process.env.DATABASE_URL, { prepare: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgConn = conn;
}

export const db = drizzle(conn, { schema });
