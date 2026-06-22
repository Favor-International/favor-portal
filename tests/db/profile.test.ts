import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb, ctxFor, seedUser } from "./helpers";
import {
  getProfile,
  updateProfile,
  getOnboardingSurvey,
  upsertOnboardingSurvey,
  getCommPreferences,
  updateCommPreferences,
} from "@/lib/db/access/profile";

let db: ReturnType<typeof makeTestDb>;
const ctxA = ctxFor("userA");
const ctxB = ctxFor("userB");
beforeEach(async () => {
  db = makeTestDb();
  await seedUser(db, "userA");
  await seedUser(db, "userB");
});

describe("profile access (owner-scoped)", () => {
  it("updateProfile writes user fields and profile details for the caller", async () => {
    const result = await updateProfile(db, ctxA, {
      firstName: "Alice",
      lastName: "Anderson",
      phone: "555-0001",
      street: "1 Main St",
      city: "Springfield",
      state: "IL",
      zip: "62704",
    });
    expect(result?.firstName).toBe("Alice");
    expect(result?.phone).toBe("555-0001");
    expect(result?.profileDetails?.street).toBe("1 Main St");
    expect(result?.profileDetails?.city).toBe("Springfield");
  });

  it("updateProfile writes only the caller's profile details (isolation)", async () => {
    await updateProfile(db, ctxA, { street: "1 Main St", city: "Springfield" });
    const a = await getProfile(db, ctxA);
    const b = await getProfile(db, ctxB);
    expect(a?.profileDetails?.street).toBe("1 Main St");
    // Denial: userB sees none of userA's address.
    expect(b?.profileDetails).toBeNull();
  });

  it("updateProfile upserts (second call updates the same row, no duplicate)", async () => {
    await updateProfile(db, ctxA, { street: "1 Main St" });
    await updateProfile(db, ctxA, { city: "Springfield" });
    const a = await getProfile(db, ctxA);
    expect(a?.profileDetails?.street).toBe("1 Main St");
    expect(a?.profileDetails?.city).toBe("Springfield");
  });

  it("getProfile returns null when the user is missing", async () => {
    const ghost = ctxFor("ghost");
    expect(await getProfile(db, ghost)).toBeNull();
  });

  it("comm preferences are isolated per user (userB cannot see userA's prefs)", async () => {
    await updateCommPreferences(db, ctxA, { smsEnabled: true, reportPeriod: "annual" });
    const a = await getCommPreferences(db, ctxA);
    const b = await getCommPreferences(db, ctxB);
    expect(a?.smsEnabled).toBe(true);
    expect(a?.reportPeriod).toBe("annual");
    // Denial: userB has no prefs row created by userA's write.
    expect(b).toBeNull();
  });

  it("updateCommPreferences upserts and sets updatedAt", async () => {
    const created = await updateCommPreferences(db, ctxA, { smsEnabled: true });
    expect(created?.updatedAt).toBeTruthy();
    const updated = await updateCommPreferences(db, ctxA, { smsEnabled: false });
    expect(updated?.smsEnabled).toBe(false);
    // Still a single row for userA (upsert, not insert).
    expect((await getCommPreferences(db, ctxA))?.smsEnabled).toBe(false);
  });

  it("onboarding survey upsert is isolated per user", async () => {
    await upsertOnboardingSurvey(db, ctxA, {
      howHeard: "friend",
      interests: ["missions", "events"],
      churchConnection: true,
    });
    const a = await getOnboardingSurvey(db, ctxA);
    const b = await getOnboardingSurvey(db, ctxB);
    expect(a?.howHeard).toBe("friend");
    expect(a?.interests).toEqual(["missions", "events"]);
    expect(a?.churchConnection).toBe(true);
    // Denial: userB has no survey from userA's write.
    expect(b).toBeNull();
  });

  it("onboarding survey upsert updates the same row on a second call", async () => {
    await upsertOnboardingSurvey(db, ctxA, { howHeard: "friend" });
    await upsertOnboardingSurvey(db, ctxA, { rddContact: "Jane Doe" });
    const a = await getOnboardingSurvey(db, ctxA);
    expect(a?.howHeard).toBe("friend");
    expect(a?.rddContact).toBe("Jane Doe");
  });
});
