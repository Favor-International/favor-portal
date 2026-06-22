import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import {
  listTemplates,
  createTemplate,
  getTemplate,
  recordSendLog,
  listSendLogs,
} from "@/lib/db/access/comms";
import { AuthorizationError } from "@/lib/db/access/authz";
import { getProfile } from "@/lib/db/access/profile";
import { logAdminAudit } from "@/lib/admin/audit";
import { logError, logInfo } from "@/lib/logger";
import { sendEmail } from "@/lib/resend/client";
import { sendSMS } from "@/lib/twilio/client";
import type { CommunicationTemplate } from "@/types";

export const runtime = "nodejs";

const VALID_CHANNELS: CommunicationTemplate["channel"][] = ["email", "sms", "direct_mail"];
const VALID_STATUS: CommunicationTemplate["status"][] = ["active", "draft"];

type TemplateRow = {
  id: string;
  channel: string;
  name: string;
  subject: string | null;
  content: string;
  status: string;
  updatedAt: string;
};

function mapTemplate(row: TemplateRow): CommunicationTemplate {
  return {
    id: row.id,
    channel: row.channel as CommunicationTemplate["channel"],
    name: row.name,
    subject: row.subject ?? undefined,
    content: row.content,
    status: row.status as CommunicationTemplate["status"],
    updatedAt: row.updatedAt,
  };
}

function renderTemplate(content: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce((result, [key, value]) => {
    return result.replaceAll(`{{${key}}}`, value);
  }, content);
}

export async function GET() {
  try {
    const auth = await adminRoute("content:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();
    const [templateRows, logRows] = await Promise.all([
      listTemplates(db, ctx),
      listSendLogs(db, ctx, 100),
    ]);

    const sendLog = logRows.map((row) => ({
      id: row.id,
      templateId: row.templateId ?? "",
      templateName: row.templateName,
      channel: row.channel as CommunicationTemplate["channel"],
      sentAt: row.sentAt,
    }));

    return NextResponse.json({
      success: true,
      templates: templateRows.map(mapTemplate),
      sendLog,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logError({ event: "admin.communications.fetch_failed", route: "/api/admin/communications", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const channel = String(body?.channel ?? "") as CommunicationTemplate["channel"];
    const name = String(body?.name ?? "").trim();
    const subject = typeof body?.subject === "string" ? body.subject.trim() : undefined;
    const content = String(body?.content ?? "").trim();
    const status = String(body?.status ?? "draft") as CommunicationTemplate["status"];

    if (!VALID_CHANNELS.includes(channel) || !name || !content || !VALID_STATUS.includes(status)) {
      return NextResponse.json({ error: "Invalid template payload" }, { status: 400 });
    }

    const auth = await adminRoute("content:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;
    const db = getDb();

    const created = await createTemplate(db, ctx, {
      channel,
      name,
      subject: subject ?? null,
      content,
      status,
    });

    await logAdminAudit(db, {
      actorUserId: ctx.userId,
      action: "admin.communications.template_created",
      entityType: "communication_template",
      entityId: created.id,
      details: { templateId: created.id },
    });

    logInfo({
      event: "admin.communications.template_created",
      route: "/api/admin/communications",
      userId: ctx.userId,
      details: { templateId: created.id },
    });

    return NextResponse.json({ success: true, template: mapTemplate(created) }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logError({ event: "admin.communications.template_create_failed", route: "/api/admin/communications", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const templateId = String(body?.templateId ?? "").trim();

    if (!templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 });
    }

    const auth = await adminRoute("content:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;
    const db = getDb();

    const [templateRow, senderRow] = await Promise.all([
      getTemplate(db, ctx, templateId),
      getProfile(db, ctx),
    ]);

    if (!templateRow) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    if (!senderRow) {
      return NextResponse.json({ error: "Sender profile not found" }, { status: 404 });
    }

    const variables = {
      firstName: senderRow.firstName,
      lastName: senderRow.lastName,
      email: senderRow.email,
      amount: "$100.00",
      date: new Date().toLocaleDateString(),
      designation: "Where Most Needed",
      constituentType: senderRow.constituentType ?? "",
    };

    const content = renderTemplate(templateRow.content, variables);
    const subject = templateRow.subject
      ? renderTemplate(templateRow.subject, variables)
      : templateRow.name;
    const requestedRecipient =
      typeof body?.recipient === "string" && body.recipient.trim().length > 0
        ? body.recipient.trim()
        : null;
    let recipient = requestedRecipient;
    let status: "sent" | "queued" | "failed" = "sent";
    let metadata: Record<string, string | number | boolean | null> = { mode: "test" };

    try {
      if (templateRow.channel === "email") {
        recipient = recipient || senderRow.email;
        if (!recipient) {
          return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
        }
        const result = await sendEmail({
          to: recipient,
          subject,
          text: content,
        });
        metadata = { ...metadata, provider: "resend", providerMessageId: result.id ?? null };
      } else if (templateRow.channel === "sms") {
        recipient = recipient || senderRow.phone || null;
        if (!recipient) {
          return NextResponse.json({ error: "Recipient phone is required" }, { status: 400 });
        }
        const result = await sendSMS(recipient, content);
        metadata = { ...metadata, provider: "twilio", providerMessageId: result.sid };
      } else {
        status = "queued";
        metadata = { ...metadata, dispatch: "manual_direct_mail" };
      }
    } catch (dispatchError) {
      status = "failed";
      metadata = {
        ...metadata,
        error: dispatchError instanceof Error ? dispatchError.message : String(dispatchError),
      };
    }

    await recordSendLog(db, ctx, {
      templateId: templateRow.id,
      templateName: templateRow.name,
      channel: templateRow.channel,
      recipient,
      status,
      metadata,
    });

    if (status === "failed") {
      return NextResponse.json(
        { error: "Dispatch failed. Check communication send logs for details." },
        { status: 502 }
      );
    }

    logInfo({
      event: "admin.communications.test_send",
      route: "/api/admin/communications",
      userId: ctx.userId,
      details: { templateId, status, channel: templateRow.channel },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logError({ event: "admin.communications.test_send_failed", route: "/api/admin/communications", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
