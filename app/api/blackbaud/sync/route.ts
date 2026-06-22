import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { getUserById, upsertSolicitCodePrefs } from "@/lib/db/access/sky";
import { blackbaudClient } from "@/lib/blackbaud/client";
import { logAdminAudit } from "@/lib/admin/audit";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const auth = await adminRoute("admin:access");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();
    const userRow = await getUserById(db, ctx.userId);
    if (!userRow) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!userRow.blackbaudConstituentId) {
      return NextResponse.json({ error: "No Blackbaud constituent linked to this user" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const solicitCodes = Array.isArray(body?.solicitCodes)
      ? body.solicitCodes.filter((code: unknown): code is string => typeof code === "string" && code.trim().length > 0)
      : [];

    await blackbaudClient.updateSolicitCodes(userRow.blackbaudConstituentId, solicitCodes);

    const syncedAt = new Date().toISOString();
    await upsertSolicitCodePrefs(db, ctx.userId, solicitCodes, syncedAt);

    await logAdminAudit(db, {
      actorUserId: ctx.userId,
      action: "blackbaud.preferences.synced",
      entityType: "blackbaud_constituent",
      entityId: userRow.blackbaudConstituentId,
      details: { solicitCodes },
    });

    return NextResponse.json({ success: true, syncedAt });
  } catch (error) {
    logError({ event: "blackbaud.preferences.sync_failed", route: "/api/blackbaud/sync", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
