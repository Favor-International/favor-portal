import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { logError, logInfo } from "@/lib/logger";
import { createMagicLinkToken } from "@/lib/auth/tokens";
import { sendWelcomeEmail } from "@/lib/resend/client";

export const runtime = "nodejs";

// Server-to-server hook from the favor-astro giving app (shared key:
// PORTAL_GIVING_API_KEY, the same trust pair used for the giving gateway).
// Called after a successful online gift:
//   1. find or create the donor's portal account
//   2. link the Blackbaud constituent id
//   3. email a welcome + dashboard sign-in link (its own token)
//   4. return a SEPARATE one-time login URL for the thank-you page button
// Never called from browsers; never exposed without the key.

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

type HookBody = {
  email?: string;
  first?: string;
  last?: string;
  phone?: string;
  amount?: number;
  frequency?: "once" | "monthly";
  designation?: string;
  constituent_id?: string;
};

export async function POST(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const configured =
      (env as { PORTAL_GIVING_API_KEY?: string }).PORTAL_GIVING_API_KEY ??
      process.env.PORTAL_GIVING_API_KEY ??
      "";
    const supplied = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!configured || !timingSafeEqual(supplied, configured)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as HookBody;
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }
    const amount = Number(body.amount) || 0;
    const frequency: "once" | "monthly" = body.frequency === "monthly" ? "monthly" : "once";
    const designation = typeof body.designation === "string" && body.designation ? body.designation : "Where Needed Most";

    const db = getDb();
    let user = await db.select().from(users).where(eq(users.email, email)).get();
    let created = false;
    if (!user) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.insert(users).values({
        id,
        email,
        firstName: (body.first ?? "").trim() || "Friend",
        lastName: (body.last ?? "").trim() || "of Favor",
        phone: body.phone ?? null,
        blackbaudConstituentId: body.constituent_id ?? null,
        constituentType: "individual",
        createdAt: now,
      });
      user = await db.select().from(users).where(eq(users.id, id)).get();
      created = true;
    } else if (body.constituent_id && !user.blackbaudConstituentId) {
      await db
        .update(users)
        .set({ blackbaudConstituentId: body.constituent_id })
        .where(eq(users.id, user.id));
    }
    if (!user) {
      return NextResponse.json({ error: "provisioning failed" }, { status: 500 });
    }

    // Two independent one-time tokens: one rides back to the thank-you page
    // button, one goes in the welcome email. Single-use tokens cannot be shared.
    const payload = { email, scope: "portal" as const, redirectTo: "/giving" };
    const pageToken = await createMagicLinkToken(env.SESSIONS, payload);
    const emailToken = await createMagicLinkToken(env.SESSIONS, payload);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://my.favorintl.org";
    const loginUrl = `${baseUrl}/verify?token=${pageToken}`;
    const emailLoginUrl = `${baseUrl}/verify?token=${emailToken}`;

    try {
      await sendWelcomeEmail(email, {
        firstName: (body.first ?? "").trim(),
        amount,
        frequency,
        designation,
        loginUrl: emailLoginUrl,
      });
    } catch (error) {
      // Email problems (e.g. domain not yet verified in Resend) must never
      // break the giving flow; the thank-you page link still works.
      logError({ event: "portal_hook.welcome_email_failed", route: "/api/portal-hooks/gift-completed", error });
    }

    logInfo({
      event: "portal_hook.gift_completed",
      route: "/api/portal-hooks/gift-completed",
      userId: user.id,
      details: { created, frequency },
    });
    return NextResponse.json({ ok: true, created, login_url: loginUrl });
  } catch (error) {
    logError({ event: "portal_hook.failed", route: "/api/portal-hooks/gift-completed", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
