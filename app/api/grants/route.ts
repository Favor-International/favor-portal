import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { listFoundationGrants } from "@/lib/db/access/giving";
import { logError } from "@/lib/logger";
import type { FoundationGrant } from "@/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const rows = await listFoundationGrants(getDb(), ctx);

    const grants: FoundationGrant[] = rows
      .map((row) => ({
        id: row.id,
        userId: row.userId,
        grantName: row.grantName,
        amount: Number(row.amount),
        startDate: row.startDate,
        endDate: row.endDate ?? undefined,
        status: (row.status ?? "pending") as FoundationGrant["status"],
        nextReportDue: row.nextReportDue ?? undefined,
        notes: row.notes ?? undefined,
        createdAt: row.createdAt ?? "",
      }))
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    return NextResponse.json({ success: true, grants });
  } catch (error) {
    logError({ event: "grants.fetch_failed", route: "/api/grants", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
