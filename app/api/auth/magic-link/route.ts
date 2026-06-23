import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users, userRoles } from "@/lib/db/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logError, logInfo } from "@/lib/logger";
import { hasAdminPermission, resolveAdminPermissions } from "@/lib/admin/roles";
import { blackbaudClient } from "@/lib/blackbaud/client";
import { createMagicLinkToken } from "@/lib/auth/tokens";
import { sendMagicLinkEmail } from "@/lib/resend/client";

export const runtime = "nodejs";

const VALID_SCOPES = ["portal", "admin"] as const;
type AuthScope = (typeof VALID_SCOPES)[number];

function normalizeScope(scope: unknown): AuthScope {
  return VALID_SCOPES.includes(scope as AuthScope) ? (scope as AuthScope) : "portal";
}

function sanitizeRedirectPath(redirectTo: unknown, scope: AuthScope): string {
  const fallback = scope === "admin" ? "/admin" : "/dashboard";
  if (typeof redirectTo !== "string") return fallback;
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) return fallback;
  if (scope === "admin" && !redirectTo.startsWith("/admin")) return "/admin";
  return redirectTo;
}

const GENERIC_OK = { success: true, message: "If an account exists, a magic link has been sent" };

export async function POST(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(env.RATE_LIMIT, `auth:magic-link:${ip}`, 6, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    const body = await request.json();
    const rawEmail = typeof body?.email === "string" ? body.email : "";
    const scope = normalizeScope(body?.scope);
    const redirectTo = sanitizeRedirectPath(body?.redirectTo, scope);

    if (!rawEmail || !rawEmail.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    const email = rawEmail.toLowerCase();
    const db = getDb();

    // Dev mode = no email provider configured. The magic link is returned in the
    // response (devLink) for ANY email instead of being emailed, and the
    // production "don't reveal whether the account exists" gate is skipped so you
    // can log in without a real inbox. This auto-disables once RESEND_API_KEY is set.
    const devMode = !process.env.RESEND_API_KEY;

    if (!devMode) {
      const existing = await db
        .select({ id: users.id, isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.email, email))
        .get();

      let canProvisionFromSky = false;
      if (!existing && scope === "portal") {
        try {
          canProvisionFromSky = Boolean(await blackbaudClient.getConstituentByEmail(email));
        } catch (skyError) {
          logError({ event: "auth.magic_link.sky_lookup_failed", route: "/api/auth/magic-link", error: skyError });
        }
      }

      // Don't reveal whether the account exists.
      if (!existing && !canProvisionFromSky) {
        return NextResponse.json(GENERIC_OK);
      }
      if (scope === "admin") {
        if (!existing) return NextResponse.json(GENERIC_OK);
        const roleRows = await db
          .select({ roleKey: userRoles.roleKey })
          .from(userRoles)
          .where(eq(userRoles.userId, existing.id))
          .all();
        const permissions = resolveAdminPermissions(Boolean(existing.isAdmin), roleRows.map((r) => r.roleKey));
        if (!hasAdminPermission("admin:access", permissions)) return NextResponse.json(GENERIC_OK);
      }
    }

    const token = await createMagicLinkToken(env.SESSIONS, { email, scope, redirectTo });

    if (!devMode) {
      await sendMagicLinkEmail(email, token);
      logInfo({ event: "auth.magic_link.sent", route: "/api/auth/magic-link", details: { scope } });
      return NextResponse.json({ success: true, message: "Magic link sent successfully" });
    }

    // Dev affordance: no email provider configured — return the link directly.
    logInfo({ event: "auth.magic_link.dev_link", route: "/api/auth/magic-link", details: { scope } });
    return NextResponse.json({
      success: true,
      message: "Dev mode: magic link generated",
      devLink: `/verify?token=${token}`,
    });
  } catch (error) {
    logError({ event: "auth.magic_link.route_failed", route: "/api/auth/magic-link", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
