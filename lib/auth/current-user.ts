import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "../db/client";
import { buildAuthContext, type AuthContext } from "../db/auth-context";
import { getSession } from "./session";
import { SESSION_COOKIE } from "./cookies";
import { AuthorizationError } from "../db/access/authz";
import { hasAdminPermission, resolveAdminPermissions } from "../admin/roles";
import type { AdminPermission } from "@/types";

// Resolve the current request's AuthContext from the session cookie, or null.
export async function getAuthContext(): Promise<AuthContext | null> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const { env } = getCloudflareContext();
  const session = await getSession(env.SESSIONS, id);
  if (!session) return null;
  return buildAuthContext(getDb(), session.userId);
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new AuthorizationError("Unauthorized");
  return ctx;
}

export async function requireAdmin(permission: AdminPermission = "admin:access"): Promise<AuthContext> {
  const ctx = await requireAuth();
  const permissions = resolveAdminPermissions(ctx.isAdmin, ctx.roleKeys);
  if (!hasAdminPermission(permission, permissions)) throw new AuthorizationError("Forbidden");
  return ctx;
}
