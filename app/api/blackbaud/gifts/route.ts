import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { getUserById } from "@/lib/db/access/sky";
import { blackbaudClient } from "@/lib/blackbaud/client";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await adminRoute("admin:access");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const requestedConstituentId = request.nextUrl.searchParams.get("constituentId");

    const userRow = await getUserById(getDb(), ctx.userId);
    if (!userRow) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const constituentId = requestedConstituentId || userRow.blackbaudConstituentId;
    if (!constituentId) {
      return NextResponse.json({ success: true, gifts: [] });
    }

    const gifts = await blackbaudClient.getGiftsByConstituentId(constituentId);
    return NextResponse.json({ success: true, gifts });
  } catch (error) {
    logError({ event: "blackbaud.gifts.fetch_failed", route: "/api/blackbaud/gifts", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
