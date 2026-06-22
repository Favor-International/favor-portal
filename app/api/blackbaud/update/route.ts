import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { blackbaudClient } from "@/lib/blackbaud/client";
import { logAdminAudit } from "@/lib/admin/audit";
import { logError } from "@/lib/logger";
import type { BlackbaudConstituent } from "@/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const auth = await adminRoute("admin:access");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const body = await request.json();
    const constituentId = typeof body?.constituentId === "string" ? body.constituentId.trim() : "";
    const updateData = (body?.data ?? {}) as Partial<BlackbaudConstituent>;

    if (!constituentId) {
      return NextResponse.json({ error: "constituentId is required" }, { status: 400 });
    }

    await blackbaudClient.updateConstituent(constituentId, updateData);

    await logAdminAudit(getDb(), {
      actorUserId: ctx.userId,
      action: "blackbaud.constituent.updated",
      entityType: "blackbaud_constituent",
      entityId: constituentId,
      details: { fields: Object.keys(updateData) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError({ event: "blackbaud.constituent.update_failed", route: "/api/blackbaud/update", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
