import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { logError, logInfo } from "@/lib/logger";
import { hashPassword, passwordMeetsPolicy, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

export const runtime = "nodejs";

// Signed-in users (magic link or password) can set or replace their password.
export async function POST(request: Request) {
  try {
    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const body = await request.json();
    const password = typeof body?.password === "string" ? body.password : "";
    if (!passwordMeetsPolicy(password)) {
      return NextResponse.json(
        { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` },
        { status: 400 },
      );
    }

    const db = getDb();
    const passwordHash = await hashPassword(password);
    await db.update(users).set({ passwordHash }).where(eq(users.id, ctx.userId));

    logInfo({ event: "auth.password.set", route: "/api/auth/password/set", userId: ctx.userId });
    return NextResponse.json({ success: true });
  } catch (error) {
    logError({ event: "auth.password.set_failed", route: "/api/auth/password/set", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
