import { describe, it, expect } from "vitest";
import { makeKv } from "./kv-stub";
import { createSession, getSession, destroySession } from "@/lib/auth/session";

describe("sessions", () => {
  it("create then get returns userId + scope", async () => {
    const kv = makeKv();
    const id = await createSession(kv, { userId: "u1", scope: "portal" });
    const s = await getSession(kv, id);
    expect(s?.userId).toBe("u1");
    expect(s?.scope).toBe("portal");
  });

  it("destroy revokes the session", async () => {
    const kv = makeKv();
    const id = await createSession(kv, { userId: "u1", scope: "admin" });
    await destroySession(kv, id);
    expect(await getSession(kv, id)).toBeNull();
  });

  it("unknown id returns null", async () => {
    const kv = makeKv();
    expect(await getSession(kv, "nope")).toBeNull();
  });
});
