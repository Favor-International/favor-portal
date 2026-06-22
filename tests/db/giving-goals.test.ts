import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb, ctxFor, seedUser } from "./helpers";
import { listGivingGoals, createGivingGoal, deleteGivingGoal } from "@/lib/db/access/giving-goals";
import { AuthorizationError } from "@/lib/db/access/authz";

let db: ReturnType<typeof makeTestDb>;
const ctxA = ctxFor("userA");
const ctxB = ctxFor("userB");
beforeEach(async () => {
  db = makeTestDb();
  await seedUser(db, "userA");
  await seedUser(db, "userB");
});

describe("giving goals access (owner-scoped)", () => {
  it("a user only lists their own goals", async () => {
    await createGivingGoal(db, ctxA, { name: "A goal", targetAmount: 100, deadline: "2026-12-31", category: "custom" });
    await createGivingGoal(db, ctxB, { name: "B goal", targetAmount: 200, deadline: "2026-12-31", category: "custom" });
    const a = await listGivingGoals(db, ctxA);
    expect(a).toHaveLength(1);
    expect(a[0].name).toBe("A goal");
  });

  it("a user cannot delete another user's goal", async () => {
    const g = await createGivingGoal(db, ctxA, { name: "A goal", targetAmount: 100, deadline: "2026-12-31", category: "custom" });
    await expect(deleteGivingGoal(db, ctxB, g.id)).rejects.toBeInstanceOf(AuthorizationError);
    expect(await listGivingGoals(db, ctxA)).toHaveLength(1);
  });
});
