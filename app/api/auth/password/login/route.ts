import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logError, logInfo } from "@/lib/logger";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/cookies";

export const runtime = "nodejs";

// Password login is optional; magic links remain the primary path. Errors are
// deliberately generic so the endpoint reveals nothing about which accounts
// exist or which have passwords set.
const GENERIC_FAIL = { error: "Invalid email or password" };

export async function POST(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(env.RATE_LIMIT, `auth:password:${ip}`, 10, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!email || !email.includes("@") || !password) {
      return NextResponse.json(GENERIC_FAIL, { status: 401 });
    }

    // Second bucket keyed on the account itself. IP-only throttling lets a
    // distributed attacker spray a single donor address indefinitely.
    const perAccount = await checkRateLimit(env.RATE_LIMIT, `auth:password:acct:${email}`, 10, 15 * 60 * 1000);
    if (!perAccount.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(perAccount.retryAfterSeconds) } },
      );
    }

    const db = getDb();
    const user = await db.select().from(users).where(eq(users.email, email)).get();
    const ok = await verifyPassword(password, user?.passwordHash);
    if (!user || !ok) {
      return NextResponse.json(GENERIC_FAIL, { status: 401 });
    }

    await db.update(users).set({ lastLogin: new Date().toISOString() }).where(eq(users.id, user.id));
    const sessionId = await createSession(env.SESSIONS, { userId: user.id, scope: "portal" });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email },
      scope: "portal",
      redirectTo: "/dashboard",
    });
    response.cookies.set(SESSION_COOKIE, sessionId, sessionCookieOptions());
    logInfo({ event: "auth.password.success", route: "/api/auth/password/login", userId: user.id });
    return response;
  } catch (error) {
    logError({ event: "auth.password.route_failed", route: "/api/auth/password/login", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
