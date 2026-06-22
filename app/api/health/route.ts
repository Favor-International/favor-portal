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
  try {
    const row = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    dbQueryOk = row?.ok === 1;
  } catch {
    dbQueryOk = false;
  }

  const ok = Object.values(checks).every(Boolean) && dbQueryOk;
  return NextResponse.json({ ok, checks, dbQueryOk });
}
