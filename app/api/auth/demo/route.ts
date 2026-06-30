import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { createSession } from "@/lib/auth/session";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/cookies";
import { logError, logInfo } from "@/lib/logger";

export const runtime = "nodejs";

// Fixed demo identities seeded into the demo D1 (db/seed/demo.sql). This route only
// works when DEMO_MODE is set (the `demo` wrangler environment), so it can never
// expose a credential-free login on the production worker.
const DEMO_PERSONAS = {
  partner: { userId: "demo-partner-user", scope: "portal" as const, redirectTo: "/dashboard" },
  admin: { userId: "demo-admin-user", scope: "admin" as const, redirectTo: "/admin" },
};

function demoEnabled(env: CloudflareEnv): boolean {
  return env.DEMO_MODE === "true";
}

export async function GET() {
  const { env } = getCloudflareContext();
  return NextResponse.json({ enabled: demoEnabled(env) });
}

export async function POST(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    if (!demoEnabled(env)) {
      return NextResponse.json({ error: "Demo mode is not enabled" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const persona = DEMO_PERSONAS[body?.persona as keyof typeof DEMO_PERSONAS];
    if (!persona) {
      return NextResponse.json({ error: "Unknown demo persona" }, { status: 400 });
    }

    const db = getDb();
    const user = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, persona.userId))
      .get();
    if (!user) {
      return NextResponse.json({ error: "Demo account not provisioned" }, { status: 500 });
    }

    await db.update(users).set({ lastLogin: new Date().toISOString() }).where(eq(users.id, user.id));

    const sessionId = await createSession(env.SESSIONS, { userId: user.id, scope: persona.scope });
    const response = NextResponse.json({ success: true, redirectTo: persona.redirectTo });
    response.cookies.set(SESSION_COOKIE, sessionId, sessionCookieOptions());

    logInfo({ event: "auth.demo.login", route: "/api/auth/demo", userId: user.id, details: { persona: body?.persona } });
    return response;
  } catch (error) {
    logError({ event: "auth.demo.route_failed", route: "/api/auth/demo", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
