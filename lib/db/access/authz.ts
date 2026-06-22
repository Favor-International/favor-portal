import type { AuthContext } from "../auth-context";

export class AuthorizationError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function canManage(ctx: AuthContext, roles: string[]): boolean {
  return ctx.isAdmin || ctx.roleKeys.some((r) => roles.includes(r));
}

export function assertOwner(ctx: AuthContext, ownerId: string): void {
  if (ctx.userId !== ownerId) throw new AuthorizationError();
}

// Course/content access-level visibility by constituent type (mirrors migrations 002/003/005).
const ACCESS_LEVEL_MATRIX: Record<string, string[]> = {
  partner: ["individual", "major_donor", "church", "foundation", "daf", "ambassador", "volunteer"],
  major_donor: ["major_donor", "foundation"],
  church: ["church"],
  foundation: ["foundation"],
  ambassador: ["ambassador"],
  daf: ["daf"],
  volunteer: ["volunteer"],
  all: ["individual", "major_donor", "church", "foundation", "daf", "ambassador", "volunteer"],
};

export function canViewCourseAccessLevel(ctx: AuthContext, accessLevel: string): boolean {
  if (ctx.isAdmin) return true;
  if (accessLevel === "all") return true;
  const allowed = ACCESS_LEVEL_MATRIX[accessLevel] ?? [];
  return ctx.constituentType != null && allowed.includes(ctx.constituentType);
}
