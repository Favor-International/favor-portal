import { NextRequest, NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { createTicketWithMessage, listMyTicketsWithMessages } from "@/lib/db/access/support";
import { recordActivity } from "@/lib/db/access/activity";
import { logError, logInfo } from "@/lib/logger";
import type { SupportMessage, SupportTicket } from "@/types";

export const runtime = "nodejs";

type TicketRow = {
  id: string;
  requesterUserId: string | null;
  category: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
};

type MessageRow = {
  id: string;
  sender: string;
  message: string;
  createdAt: string;
};

function mapTicket(row: TicketRow): SupportTicket {
  return {
    id: row.id,
    requesterUserId: row.requesterUserId ?? undefined,
    category: row.category,
    subject: row.subject,
    message: row.message,
    status: row.status as SupportTicket["status"],
    priority: row.priority as SupportTicket["priority"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt ?? undefined,
    requesterName: row.requesterName ?? undefined,
    requesterEmail: row.requesterEmail ?? undefined,
  };
}

function mapMessage(row: MessageRow): SupportMessage {
  return {
    id: row.id,
    sender: row.sender as SupportMessage["sender"],
    message: row.message,
    createdAt: row.createdAt,
  };
}

export async function GET() {
  try {
    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const rows = await listMyTicketsWithMessages(getDb(), ctx);
    const tickets = rows.map((row) => ({
      ...mapTicket(row),
      messages: row.messages.map(mapMessage),
    }));

    return NextResponse.json({ success: true, tickets });
  } catch (error) {
    logError({ event: "support.fetch_failed", route: "/api/support", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const category = String(body?.category ?? "").trim();
    const subject = String(body?.subject ?? "").trim();
    const message = String(body?.message ?? "").trim();

    if (!category || !subject || !message) {
      return NextResponse.json({ error: "Category, subject, and message are required" }, { status: 400 });
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;
    const db = getDb();

    const created = await createTicketWithMessage(db, ctx, { category, subject, message });

    await recordActivity(db, ctx, {
      type: "support_ticket",
      metadata: { category, subject },
    });

    const ticket = {
      ...mapTicket(created),
      messages: created.messages.map(mapMessage),
    };

    logInfo({
      event: "support.ticket_created",
      route: "/api/support",
      userId: ctx.userId,
      details: { category },
    });

    return NextResponse.json({ success: true, ticket }, { status: 201 });
  } catch (error) {
    logError({ event: "support.ticket_create_failed", route: "/api/support", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
