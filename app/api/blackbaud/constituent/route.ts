import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { blackbaudClient } from "@/lib/blackbaud/client";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await adminRoute("admin:access");
    if ("error" in auth) return auth.error;

    const email = request.nextUrl.searchParams.get("email")?.toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Missing session email" }, { status: 400 });
    }

    const constituent = await blackbaudClient.getConstituentByEmail(email);
    if (!constituent) {
      return NextResponse.json({ error: "Constituent not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, constituent });
  } catch (error) {
    logError({ event: "blackbaud.constituent.fetch_failed", route: "/api/blackbaud/constituent", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
