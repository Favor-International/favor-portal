import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users, userRoles } from "@/lib/db/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logError, logInfo } from "@/lib/logger";
import { hasAdminPermission, resolveAdminPermissions } from "@/lib/admin/roles";
import { blackbaudClient } from "@/lib/blackbaud/client";
import type { BlackbaudConstituent } from "@/types";
import { consumeMagicLinkToken } from "@/lib/auth/tokens";
import { createSession } from "@/lib/auth/session";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/cookies";
import { findOrProvisionUser } from "@/lib/auth/provision";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(env.RATE_LIMIT, `auth:verify:${ip}`, 20, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    const body = await request.json();
    const token: string = body?.token ?? body?.tokenHash ?? "";
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const payload = await consumeMagicLinkToken(env.SESSIONS, token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const db = getDb();
    const email = payload.email.toLowerCase();

    // If the user is new, try to enrich from SKY before provisioning.
    let constituent: BlackbaudConstituent | null = null;
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
    if (!existing && payload.scope === "portal") {
      try {
        constituent = await blackbaudClient.getConstituentByEmail(email);
      } catch (skyError) {
        logError({ event: "auth.verify.sky_lookup_failed", route: "/api/auth/verify", error: skyError });
      }
    }

    const user = await findOrProvisionUser(db, email, {
      constituent,
      allowDevCreate: !process.env.RESEND_API_KEY,
    });
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 401 });
    }

    if (payload.scope === "admin") {
      const roleRows = await db
        .select({ roleKey: userRoles.roleKey })
        .from(userRoles)
        .where(eq(userRoles.userId, user.id))
        .all();
      const permissions = resolveAdminPermissions(Boolean(user.isAdmin), roleRows.map((r) => r.roleKey));
      if (!hasAdminPermission("admin:access", permissions)) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    await db.update(users).set({ lastLogin: new Date().toISOString() }).where(eq(users.id, user.id));

    const sessionId = await createSession(env.SESSIONS, { userId: user.id, scope: payload.scope });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email },
      scope: payload.scope,
      redirectTo: payload.redirectTo,
    });
    response.cookies.set(SESSION_COOKIE, sessionId, sessionCookieOptions());

    logInfo({ event: "auth.verify.success", route: "/api/auth/verify", userId: user.id, details: { scope: payload.scope } });
    return response;
  } catch (error) {
    logError({ event: "auth.verify.route_failed", route: "/api/auth/verify", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
