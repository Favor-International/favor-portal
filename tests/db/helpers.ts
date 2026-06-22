import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/lib/db/schema";
import { users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import type { AuthContext } from "@/lib/db/auth-context";

// In-memory SQLite with the real generated D1 migrations applied.
// Cast to Db: the better-sqlite3 driver is API-compatible with the D1 query
// builders used by the access layer (await works for both sync and async).
export function makeTestDb(): Db {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "db/migrations" });
  return db as unknown as Db;
}

export function ctxFor(userId: string, over: Partial<Omit<AuthContext, "userId">> = {}): AuthContext {
  return { userId, isAdmin: false, roleKeys: [], constituentType: "individual", ...over };
}

// Insert a minimal user row so foreign keys referencing users.id are satisfied.
export async function seedUser(db: Db, id: string): Promise<void> {
  await db.insert(users).values({ id, email: `${id}@example.com`, firstName: "Test", lastName: id });
}
