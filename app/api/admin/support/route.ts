import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import {
  addMessage,
  getTicket,
  listAllTicketsWithMessages,
  updateTicketStatus,
} from "@/lib/db/access/support";
import { AuthorizationError } from "@/lib/db/access/authz";
import { logError, logInfo } from "@/lib/logger";
import type { SupportMessage, SupportTicket } from "@/types";

export const runtime = "nodejs";

type TicketStatus = SupportTicket["status"];
const VALID_STATUSES: TicketStatus[] = ["open", "in_progress", "resolved"];

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
    const auth = await adminRoute("support:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const rows = await listAllTicketsWithMessages(getDb(), ctx);
    const tickets = rows.map((row) => ({
      ...mapTicket(row),
      messages: row.messages.map(mapMessage),
    }));

    return NextResponse.json({ success: true, tickets });
  } catch (error) {
    logError({ event: "admin.support.fetch_failed", route: "/api/admin/support", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const ticketId = String(body?.ticketId ?? "").trim();
    const status = String(body?.status ?? "") as TicketStatus;

    if (!ticketId || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Valid ticketId and status are required" }, { status: 400 });
    }

    const auth = await adminRoute("support:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;
    const db = getDb();

    let ticketRow;
    try {
      const existing = await getTicket(db, ctx, ticketId);
      if (!existing) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }
      await updateTicketStatus(db, ctx, ticketId, status);
      ticketRow = await getTicket(db, ctx, ticketId);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      throw error;
    }

    if (!ticketRow) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    logInfo({
      event: "admin.support.status_updated",
      route: "/api/admin/support",
      userId: ctx.userId,
      details: { ticketId, status },
    });

    return NextResponse.json({ success: true, ticket: mapTicket(ticketRow) });
  } catch (error) {
    logError({ event: "admin.support.status_update_failed", route: "/api/admin/support", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ticketId = String(body?.ticketId ?? "").trim();
    const message = String(body?.message ?? "").trim();

    if (!ticketId || !message) {
      return NextResponse.json({ error: "ticketId and message are required" }, { status: 400 });
    }

    const auth = await adminRoute("support:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;
    const db = getDb();

    try {
      const ticket = await getTicket(db, ctx, ticketId);
      if (!ticket) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }

      await addMessage(db, ctx, ticketId, message);

      if (ticket.status !== "resolved") {
        await updateTicketStatus(db, ctx, ticketId, "in_progress");
      }
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      throw error;
    }

    logInfo({
      event: "admin.support.reply_sent",
      route: "/api/admin/support",
      userId: ctx.userId,
      details: { ticketId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError({ event: "admin.support.reply_failed", route: "/api/admin/support", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
