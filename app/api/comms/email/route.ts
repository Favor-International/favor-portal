import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { recordSendLog } from "@/lib/db/access/comms";
import { AuthorizationError } from "@/lib/db/access/authz";
import { sendEmail } from "@/lib/resend/client";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const to = body?.to;
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const html = typeof body?.html === "string" ? body.html : undefined;
    const text = typeof body?.text === "string" ? body.text : undefined;
    const from = typeof body?.from === "string" ? body.from : undefined;

    if (!to || !subject || (!html && !text)) {
      return NextResponse.json(
        { error: "to, subject, and either html or text are required" },
        { status: 400 }
      );
    }

    const auth = await adminRoute("content:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;
    const db = getDb();

    const recipient = Array.isArray(to) ? to.join(", ") : String(to);

    let result;
    try {
      result = await sendEmail({
        to,
        subject,
        from,
        ...(html ? { html, text } : { text: text as string }),
      });
    } catch (dispatchError) {
      await recordSendLog(db, ctx, {
        templateName: subject,
        channel: "email",
        recipient,
        status: "failed",
        metadata: {
          provider: "resend",
          error: dispatchError instanceof Error ? dispatchError.message : String(dispatchError),
        },
      });
      throw dispatchError;
    }

    await recordSendLog(db, ctx, {
      templateName: subject,
      channel: "email",
      recipient,
      status: "sent",
      metadata: { provider: "resend", providerMessageId: result.id ?? null },
    });

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logError({ event: "comms.email.send_failed", route: "/api/comms/email", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
