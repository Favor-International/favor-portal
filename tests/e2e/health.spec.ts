import { test, expect } from "@playwright/test";

test("health endpoint reports all Cloudflare bindings reachable", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.checks).toMatchObject({
    DB: true,
    SESSIONS: true,
    RATE_LIMIT: true,
    R2: true,
  });
  expect(body.dbQueryOk).toBe(true);
});
