import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const { env } = getCloudflareContext();

  const checks = {
    DB: Boolean(env.DB),
    SESSIONS: Boolean(env.SESSIONS),
    RATE_LIMIT: Boolean(env.RATE_LIMIT),
    R2: Boolean(env.R2),
  };

  let dbQueryOk = false;
  let tableCount = 0;
  try {
    const row = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    dbQueryOk = row?.ok === 1;
    const countRow = await env.DB.prepare(
      "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations'",
    ).first<{ n: number }>();
    tableCount = countRow?.n ?? 0;
  } catch {
    dbQueryOk = false;
  }

  const ok = Object.values(checks).every(Boolean) && dbQueryOk;
  return NextResponse.json({ ok, checks, dbQueryOk, tableCount });
}
