import { describe, it, expect } from "vitest";
import { canManage, canViewCourseAccessLevel } from "@/lib/db/access/authz";

const base = { userId: "u1", isAdmin: false, roleKeys: [] as string[], constituentType: "individual" as string | null };

describe("authz helpers", () => {
  it("admin can manage anything", () => {
    expect(canManage({ ...base, isAdmin: true }, ["lms_manager"])).toBe(true);
  });
  it("role match grants manage", () => {
    expect(canManage({ ...base, roleKeys: ["lms_manager"] }, ["lms_manager"])).toBe(true);
  });
  it("no role denies manage", () => {
    expect(canManage(base, ["lms_manager"])).toBe(false);
  });
  it("partner course visible to individual", () => {
    expect(canViewCourseAccessLevel(base, "partner")).toBe(true);
  });
  it("major_donor course hidden from individual", () => {
    expect(canViewCourseAccessLevel(base, "major_donor")).toBe(false);
  });
  it("admin sees any access level", () => {
    expect(canViewCourseAccessLevel({ ...base, isAdmin: true }, "major_donor")).toBe(true);
  });
});
