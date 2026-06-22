import { describe, it, expect } from "vitest";
import { makeKv } from "./kv-stub";
import { createMagicLinkToken, consumeMagicLinkToken } from "@/lib/auth/tokens";

describe("magic-link tokens", () => {
  it("create then consume returns the payload", async () => {
    const kv = makeKv();
    const token = await createMagicLinkToken(kv, { email: "a@example.com", scope: "portal", redirectTo: "/dashboard" });
    expect(await consumeMagicLinkToken(kv, token)).toEqual({
      email: "a@example.com",
      scope: "portal",
      redirectTo: "/dashboard",
    });
  });

  it("is single-use", async () => {
    const kv = makeKv();
    const token = await createMagicLinkToken(kv, { email: "a@example.com", scope: "portal", redirectTo: "/dashboard" });
    await consumeMagicLinkToken(kv, token);
    expect(await consumeMagicLinkToken(kv, token)).toBeNull();
  });

  it("unknown token returns null", async () => {
    const kv = makeKv();
    expect(await consumeMagicLinkToken(kv, "not-a-real-token")).toBeNull();
  });
});
