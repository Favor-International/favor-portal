import { describe, it, expect } from "vitest";
import { makeKv } from "./kv-stub";
import { checkRateLimit } from "@/lib/rate-limit";

describe("rate limit (KV-backed)", () => {
  it("allows up to the limit then blocks", async () => {
    const kv = makeKv();
    const now = 1000;
    const r1 = await checkRateLimit(kv, "k", 2, 60_000, now);
    const r2 = await checkRateLimit(kv, "k", 2, 60_000, now);
    const r3 = await checkRateLimit(kv, "k", 2, 60_000, now);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
    expect(r3.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window elapses", async () => {
    const kv = makeKv();
    await checkRateLimit(kv, "k", 1, 60_000, 1000);
    expect((await checkRateLimit(kv, "k", 1, 60_000, 1000)).allowed).toBe(false);
    expect((await checkRateLimit(kv, "k", 1, 60_000, 1000 + 60_001)).allowed).toBe(true);
  });
});
