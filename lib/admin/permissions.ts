import {
  AdminPermission,
  AdminRoleKey,
  hasAdminPermission,
  normalizeAdminRoles,
  resolveAdminPermissions,
} from "@/lib/admin/roles";
import type { AuthContext } from "@/lib/db/auth-context";

export interface AdminAccessContext {
  userId: string;
  isAdmin: boolean;
  roles: AdminRoleKey[];
  permissions: AdminPermission[];
}

// Derive an admin access context from the request AuthContext (no DB call needed —
// AuthContext already carries isAdmin + roleKeys).
export function getAdminAccessContext(ctx: AuthContext): AdminAccessContext {
  const roles = normalizeAdminRoles(ctx.roleKeys);
  return {
    userId: ctx.userId,
    isAdmin: ctx.isAdmin,
    roles,
    permissions: resolveAdminPermissions(ctx.isAdmin, roles),
  };
}

export function requireAdminPermission(context: AdminAccessContext, permission: AdminPermission): boolean {
  return hasAdminPermission(permission, context.permissions);
}
