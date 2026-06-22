import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { destroySession } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/cookies";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { env } = getCloudflareContext();
  const id = request.cookies.get(SESSION_COOKIE)?.value;
  if (id) await destroySession(env.SESSIONS, id);

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
