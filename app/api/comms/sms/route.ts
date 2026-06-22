import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { recordSendLog } from "@/lib/db/access/comms";
import { AuthorizationError } from "@/lib/db/access/authz";
import { sendSMS } from "@/lib/twilio/client";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const to = typeof body?.to === "string" ? body.to.trim() : "";
    const message = typeof body?.body === "string" ? body.body.trim() : "";

    if (!to || !message) {
      return NextResponse.json({ error: "to and body are required" }, { status: 400 });
    }

    const auth = await adminRoute("content:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;
    const db = getDb();

    let result;
    try {
      result = await sendSMS(to, message);
    } catch (dispatchError) {
      await recordSendLog(db, ctx, {
        templateName: "Direct SMS",
        channel: "sms",
        recipient: to,
        status: "failed",
        metadata: {
          provider: "twilio",
          error: dispatchError instanceof Error ? dispatchError.message : String(dispatchError),
        },
      });
      throw dispatchError;
    }

    await recordSendLog(db, ctx, {
      templateName: "Direct SMS",
      channel: "sms",
      recipient: to,
      status: "sent",
      metadata: { provider: "twilio", providerMessageId: result.sid },
    });

    return NextResponse.json({ success: true, id: result.sid });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logError({ event: "comms.sms.send_failed", route: "/api/comms/sms", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
