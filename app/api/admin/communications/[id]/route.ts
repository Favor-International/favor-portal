import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { updateTemplate, deleteTemplate, getTemplate } from "@/lib/db/access/comms";
import { AuthorizationError } from "@/lib/db/access/authz";
import { logAdminAudit } from "@/lib/admin/audit";
import { logError, logInfo } from "@/lib/logger";
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const auth = await adminRoute("content:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const channel = body?.channel as CommunicationTemplate["channel"] | undefined;
    const status = body?.status as CommunicationTemplate["status"] | undefined;

    if (channel && !VALID_CHANNELS.includes(channel)) {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }

    if (status && !VALID_STATUS.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const db = getDb();

    const updated = await updateTemplate(db, ctx, id, {
      ...(body?.channel !== undefined ? { channel: body.channel } : {}),
      ...(body?.name !== undefined ? { name: body.name } : {}),
      ...(body?.subject !== undefined ? { subject: body.subject ?? null } : {}),
      ...(body?.content !== undefined ? { content: body.content } : {}),
      ...(body?.status !== undefined ? { status: body.status } : {}),
    });

    if (!updated) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await logAdminAudit(db, {
      actorUserId: ctx.userId,
      action: "admin.communications.template_updated",
      entityType: "communication_template",
      entityId: id,
      details: { templateId: id },
    });

    logInfo({
      event: "admin.communications.template_updated",
      route: "/api/admin/communications/[id]",
      userId: ctx.userId,
      details: { templateId: id },
    });

    return NextResponse.json({ success: true, template: mapTemplate(updated) });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logError({ event: "admin.communications.template_update_failed", route: "/api/admin/communications/[id]", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const auth = await adminRoute("content:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;
    const db = getDb();

    const existing = await getTemplate(db, ctx, id);
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await deleteTemplate(db, ctx, id);

    await logAdminAudit(db, {
      actorUserId: ctx.userId,
      action: "admin.communications.template_deleted",
      entityType: "communication_template",
      entityId: id,
      details: { templateId: id },
    });

    logInfo({
      event: "admin.communications.template_deleted",
      route: "/api/admin/communications/[id]",
      userId: ctx.userId,
      details: { templateId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logError({ event: "admin.communications.template_delete_failed", route: "/api/admin/communications/[id]", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
