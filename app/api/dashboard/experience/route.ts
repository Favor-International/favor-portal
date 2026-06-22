import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { listDashboardOverrides } from "@/lib/db/access/content";
import { sanitizeDashboardRoleOverrides } from "@/lib/dashboard/experience-overrides";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    let rows;
    try {
      rows = await listDashboardOverrides(getDb(), ctx);
    } catch (error) {
      logError({ event: "dashboard.experience.fetch_failed", route: "/api/dashboard/experience", error });
      return NextResponse.json({ success: true, overrides: [] });
    }

    const overrides = sanitizeDashboardRoleOverrides(
      rows.map((row) => ({
        roleKey: row.roleKey,
        highlights: row.highlights,
        actions: row.actions,
        updatedAt: row.updatedAt,
      }))
    );

    return NextResponse.json({ success: true, overrides });
  } catch (error) {
    logError({ event: "dashboard.experience.unexpected_error", route: "/api/dashboard/experience", error });
    return NextResponse.json({ success: true, overrides: [] });
  }
}
