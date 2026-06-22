import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import {
  deleteDashboardOverride,
  listDashboardOverrides,
  upsertDashboardOverride,
} from "@/lib/db/access/content";
import { AuthorizationError } from "@/lib/db/access/authz";
import { logAdminAudit } from "@/lib/admin/audit";
import {
  compactDashboardRoleOverride,
  DASHBOARD_ROLE_KEYS,
  sanitizeDashboardRoleOverride,
  sanitizeDashboardRoleOverrides,
} from "@/lib/dashboard/experience-overrides";
import { logError, logInfo } from "@/lib/logger";

export const runtime = "nodejs";

type DashboardOverrideRow = {
  roleKey: (typeof DASHBOARD_ROLE_KEYS)[number];
  highlights: unknown[];
  actions: unknown[];
  updatedAt: string;
};

export async function GET() {
  try {
    const auth = await adminRoute("content:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const rows = (await listDashboardOverrides(getDb(), ctx)) as DashboardOverrideRow[];

    const overrides = sanitizeDashboardRoleOverrides(
      rows
        .map((row) => ({
          roleKey: row.roleKey,
          highlights: row.highlights,
          actions: row.actions,
          updatedAt: row.updatedAt,
        }))
        .sort((a, b) => a.roleKey.localeCompare(b.roleKey))
    );

    return NextResponse.json({ success: true, overrides });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logError({
      event: "admin.dashboard_experience.fetch_failed",
      route: "/api/admin/dashboard/experience",
      error,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const override = sanitizeDashboardRoleOverride(body);
    if (!override || !DASHBOARD_ROLE_KEYS.includes(override.roleKey)) {
      return NextResponse.json({ error: "Invalid override payload" }, { status: 400 });
    }

    const compactOverride = compactDashboardRoleOverride(override);

    const auth = await adminRoute("content:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();

    let saved;
    try {
      saved = (await upsertDashboardOverride(db, ctx, {
        roleKey: compactOverride.roleKey,
        highlights: compactOverride.highlights,
        actions: compactOverride.actions,
      })) as DashboardOverrideRow | undefined;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      throw error;
    }

    if (!saved) {
      return NextResponse.json({ error: "Unable to persist override" }, { status: 500 });
    }

    await logAdminAudit(db, {
      actorUserId: ctx.userId,
      action: "admin.dashboard_experience.updated",
      entityType: "portal_dashboard_override",
      entityId: compactOverride.roleKey,
      details: { roleKey: compactOverride.roleKey },
    });

    logInfo({
      event: "admin.dashboard_experience.updated",
      route: "/api/admin/dashboard/experience",
      userId: ctx.userId,
      details: { roleKey: compactOverride.roleKey },
    });

    return NextResponse.json({
      success: true,
      override: sanitizeDashboardRoleOverride(
        {
          roleKey: saved.roleKey,
          highlights: saved.highlights,
          actions: saved.actions,
          updatedAt: saved.updatedAt,
        },
        compactOverride.roleKey
      ),
    });
  } catch (error) {
    logError({
      event: "admin.dashboard_experience.update_failed",
      route: "/api/admin/dashboard/experience",
      error,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const roleKey = typeof body?.roleKey === "string" ? body.roleKey : "";
    if (!DASHBOARD_ROLE_KEYS.includes(roleKey as (typeof DASHBOARD_ROLE_KEYS)[number])) {
      return NextResponse.json({ error: "Invalid role key" }, { status: 400 });
    }

    const auth = await adminRoute("content:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();

    try {
      await deleteDashboardOverride(db, ctx, roleKey as (typeof DASHBOARD_ROLE_KEYS)[number]);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      throw error;
    }

    const rows = (await listDashboardOverrides(db, ctx)) as DashboardOverrideRow[];
    const overrides = sanitizeDashboardRoleOverrides(
      rows
        .map((row) => ({
          roleKey: row.roleKey,
          highlights: row.highlights,
          actions: row.actions,
          updatedAt: row.updatedAt,
        }))
        .sort((a, b) => a.roleKey.localeCompare(b.roleKey))
    );

    return NextResponse.json({ success: true, overrides });
  } catch (error) {
    logError({
      event: "admin.dashboard_experience.delete_failed",
      route: "/api/admin/dashboard/experience",
      error,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
