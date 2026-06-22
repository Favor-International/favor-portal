import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb, ctxFor, seedUser } from "./helpers";
import {
  listGivingHistory,
  createOneTimeGift,
  listRecurringGifts,
  updateRecurringGiftStatus,
  cancelRecurringGift,
  listFoundationGrants,
  createFoundationGrant,
  updateFoundationGrant,
} from "@/lib/db/access/giving";
import { recurringGifts } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/db/access/authz";
import type { Db } from "@/lib/db/client";

// Seed a recurring gift directly (no create fn exists for these in the slice).
async function seedRecurringGift(db: Db, userId: string, id: string) {
  await db.insert(recurringGifts).values({
    id,
    userId,
    amount: 50,
    frequency: "monthly",
    nextChargeDate: "2026-07-01",
    stripeSubscriptionId: `sub_${id}`,
    status: "active",
  });
}

let db: ReturnType<typeof makeTestDb>;
const ctxA = ctxFor("userA");
const ctxB = ctxFor("userB");
const adminCtx = ctxFor("admin", { isAdmin: true });

beforeEach(async () => {
  db = makeTestDb();
  await seedUser(db, "userA");
  await seedUser(db, "userB");
  await seedUser(db, "admin");
});

describe("giving history access (owner-scoped)", () => {
  it("listGivingHistory returns only the caller's gifts", async () => {
    await createOneTimeGift(db, ctxA, { amount: 100, designation: "General", giftDate: "2026-01-01" });
    await createOneTimeGift(db, ctxA, { amount: 200, designation: "General", giftDate: "2026-03-01" });
    await createOneTimeGift(db, ctxB, { amount: 999, designation: "General", giftDate: "2026-02-01" });

    const a = await listGivingHistory(db, ctxA);
    expect(a).toHaveLength(2);
    expect(a.every((r) => r.userId === "userA")).toBe(true);
    // ordered by giftDate desc
    expect(a[0].giftDate).toBe("2026-03-01");
    expect(a[1].giftDate).toBe("2026-01-01");
  });

  it("createOneTimeGift records an own portal, non-recurring gift", async () => {
    const row = await createOneTimeGift(db, ctxA, {
      amount: 75,
      designation: "Missions",
      giftDate: "2026-04-01",
      note: "thank you",
    });
    expect(row.userId).toBe("userA");
    expect(row.source).toBe("portal");
    expect(row.isRecurring).toBe(false);
    expect(row.note).toBe("thank you");
    expect(await listGivingHistory(db, ctxB)).toHaveLength(0);
  });
});

describe("recurring gifts access (owner-scoped)", () => {
  it("listRecurringGifts returns only the caller's gifts", async () => {
    await seedRecurringGift(db, "userA", "rgA");
    await seedRecurringGift(db, "userB", "rgB");
    const a = await listRecurringGifts(db, ctxA);
    expect(a).toHaveLength(1);
    expect(a[0].id).toBe("rgA");
  });

  it("updateRecurringGiftStatus updates the owner's gift", async () => {
    await seedRecurringGift(db, "userA", "rgA");
    await updateRecurringGiftStatus(db, ctxA, "rgA", "paused");
    const a = await listRecurringGifts(db, ctxA);
    expect(a[0].status).toBe("paused");
  });

  it("cancelRecurringGift cancels the owner's gift", async () => {
    await seedRecurringGift(db, "userA", "rgA");
    await cancelRecurringGift(db, ctxA, "rgA");
    const a = await listRecurringGifts(db, ctxA);
    expect(a[0].status).toBe("cancelled");
  });

  // DENIAL test
  it("userB cannot update the status of userA's recurring gift", async () => {
    await seedRecurringGift(db, "userA", "rgA");
    await expect(updateRecurringGiftStatus(db, ctxB, "rgA", "cancelled")).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    const a = await listRecurringGifts(db, ctxA);
    expect(a[0].status).toBe("active");
  });

  it("userB cannot cancel userA's recurring gift", async () => {
    await seedRecurringGift(db, "userA", "rgA");
    await expect(cancelRecurringGift(db, ctxB, "rgA")).rejects.toBeInstanceOf(AuthorizationError);
    const a = await listRecurringGifts(db, ctxA);
    expect(a[0].status).toBe("active");
  });
});

describe("foundation grants access (owner reads, admin writes)", () => {
  it("listFoundationGrants is per-user", async () => {
    await createFoundationGrant(db, adminCtx, {
      userId: "userA",
      grantName: "Grant A",
      amount: 1000,
      startDate: "2026-01-01",
    });
    await createFoundationGrant(db, adminCtx, {
      userId: "userB",
      grantName: "Grant B",
      amount: 2000,
      startDate: "2026-01-01",
    });

    const a = await listFoundationGrants(db, ctxA);
    expect(a).toHaveLength(1);
    expect(a[0].grantName).toBe("Grant A");
    expect(a[0].userId).toBe("userA");

    const b = await listFoundationGrants(db, ctxB);
    expect(b).toHaveLength(1);
    expect(b[0].grantName).toBe("Grant B");
  });

  it("an admin can update a foundation grant", async () => {
    const g = await createFoundationGrant(db, adminCtx, {
      userId: "userA",
      grantName: "Grant A",
      amount: 1000,
      startDate: "2026-01-01",
    });
    await updateFoundationGrant(db, adminCtx, g.id, { status: "approved", amount: 1500 });
    const a = await listFoundationGrants(db, ctxA);
    expect(a[0].status).toBe("approved");
    expect(a[0].amount).toBe(1500);
  });

  // DENIAL test
  it("a non-admin cannot create a foundation grant", async () => {
    await expect(
      createFoundationGrant(db, ctxA, {
        userId: "userA",
        grantName: "Sneaky Grant",
        amount: 1000,
        startDate: "2026-01-01",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(await listFoundationGrants(db, ctxA)).toHaveLength(0);
  });

  it("a non-admin cannot update a foundation grant", async () => {
    const g = await createFoundationGrant(db, adminCtx, {
      userId: "userA",
      grantName: "Grant A",
      amount: 1000,
      startDate: "2026-01-01",
    });
    await expect(
      updateFoundationGrant(db, ctxA, g.id, { amount: 9999 }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    const a = await listFoundationGrants(db, ctxA);
    expect(a[0].amount).toBe(1000);
  });
});
