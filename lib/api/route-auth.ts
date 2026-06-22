import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/current-user";
import { resolveAdminPermissions, hasAdminPermission } from "@/lib/admin/roles";
import type { AdminPermission } from "@/types";
import type { AuthContext } from "@/lib/db/auth-context";

export type RouteAuth = { ctx: AuthContext } | { error: NextResponse };

// Usage in a route handler:
//   const auth = await authedRoute();
//   if ("error" in auth) return auth.error;
//   const { ctx } = auth;
export async function authedRoute(): Promise<RouteAuth> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { ctx };
}

export async function adminRoute(permission: AdminPermission = "admin:access"): Promise<RouteAuth> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const perms = resolveAdminPermissions(ctx.isAdmin, ctx.roleKeys);
  if (!hasAdminPermission(permission, perms)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ctx };
}
