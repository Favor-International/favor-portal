import { asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../client";
import type { AuthContext } from "../auth-context";
import { supportTickets, supportMessages, users } from "../schema";
import { AuthorizationError, canManage } from "./authz";

type SupportTicket = typeof supportTickets.$inferSelect;

export type NewTicket = {
  category: string;
  subject: string;
  message: string;
  priority?: "low" | "normal" | "high" | "urgent";
};

export type TicketStatus = "open" | "in_progress" | "resolved";

// Roles that may view/triage every ticket.
const TICKET_VIEWER_ROLES = ["support_manager", "analyst"];
// Roles that may mutate tickets (status changes, staff replies).
const TICKET_MANAGER_ROLES = ["support_manager"];

// A ticket is accessible when the caller owns it or holds a viewer role.
function canAccessTicket(ctx: AuthContext, ticket: SupportTicket): boolean {
  return ticket.requesterUserId === ctx.userId || canManage(ctx, TICKET_VIEWER_ROLES);
}

export async function createTicket(db: Db, ctx: AuthContext, input: NewTicket) {
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    requesterUserId: ctx.userId,
    requesterName: null,
    requesterEmail: null,
    category: input.category,
    subject: input.subject,
    message: input.message,
    status: "open" as TicketStatus,
    priority: input.priority ?? "normal",
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  };
  await db.insert(supportTickets).values(row);
  return row;
}

export async function listMyTickets(db: Db, ctx: AuthContext) {
  return db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.requesterUserId, ctx.userId))
    .orderBy(desc(supportTickets.createdAt))
    .all();
}

// Owner-scoped: the caller's tickets, each with its messages (oldest first)
// attached under `messages`.
export async function listMyTicketsWithMessages(db: Db, ctx: AuthContext) {
  const tickets = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.requesterUserId, ctx.userId))
    .orderBy(desc(supportTickets.createdAt))
    .all();
  if (tickets.length === 0) return [];
  const ticketIds = tickets.map((t) => t.id);
  const messages = await db
    .select()
    .from(supportMessages)
    .where(inArray(supportMessages.ticketId, ticketIds))
    .orderBy(asc(supportMessages.createdAt))
    .all();
  const byTicket = new Map<string, typeof messages>();
  for (const m of messages) {
    const list = byTicket.get(m.ticketId) ?? [];
    list.push(m);
    byTicket.set(m.ticketId, list);
  }
  return tickets.map((t) => ({ ...t, messages: byTicket.get(t.id) ?? [] }));
}

// Owner-scoped: create a ticket stamped with the requester's name/email and seed
// it with the requester's opening message. Returns the ticket with its single
// `partner` message attached.
export async function createTicketWithMessage(db: Db, ctx: AuthContext, input: NewTicket) {
  const requester = await db
    .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .get();
  const now = new Date().toISOString();
  const ticket = {
    id: crypto.randomUUID(),
    requesterUserId: ctx.userId,
    requesterName: requester ? `${requester.firstName} ${requester.lastName}` : null,
    requesterEmail: requester?.email ?? null,
    category: input.category,
    subject: input.subject,
    message: input.message,
    status: "open" as TicketStatus,
    priority: input.priority ?? "normal",
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  };
  await db.insert(supportTickets).values(ticket);
  const message = {
    id: crypto.randomUUID(),
    ticketId: ticket.id,
    sender: "partner" as const,
    senderUserId: ctx.userId,
    message: input.message,
    createdAt: now,
  };
  await db.insert(supportMessages).values(message);
  return { ...ticket, messages: [message] };
}

export async function listAllTickets(db: Db, ctx: AuthContext) {
  if (!canManage(ctx, TICKET_VIEWER_ROLES)) throw new AuthorizationError();
  return db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)).all();
}

export async function getTicket(db: Db, ctx: AuthContext, id: string) {
  const ticket = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).get();
  if (!ticket) return null;
  if (!canAccessTicket(ctx, ticket)) throw new AuthorizationError();
  return ticket;
}

export async function updateTicketStatus(db: Db, ctx: AuthContext, id: string, status: TicketStatus) {
  if (!canManage(ctx, TICKET_MANAGER_ROLES)) throw new AuthorizationError();
  const now = new Date().toISOString();
  await db
    .update(supportTickets)
    .set({
      status,
      updatedAt: now,
      ...(status === "resolved" ? { resolvedAt: now } : {}),
    })
    .where(eq(supportTickets.id, id));
}

export async function listMessages(db: Db, ctx: AuthContext, ticketId: string) {
  const ticket = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).get();
  if (!ticket || !canAccessTicket(ctx, ticket)) throw new AuthorizationError();
  return db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.ticketId, ticketId))
    .orderBy(desc(supportMessages.createdAt))
    .all();
}

export async function addMessage(db: Db, ctx: AuthContext, ticketId: string, message: string) {
  const ticket = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).get();
  if (!ticket) throw new AuthorizationError();

  let sender: "partner" | "staff";
  if (ticket.requesterUserId === ctx.userId) {
    sender = "partner";
  } else if (canManage(ctx, TICKET_MANAGER_ROLES)) {
    sender = "staff";
  } else {
    throw new AuthorizationError();
  }

  const row = {
    id: crypto.randomUUID(),
    ticketId,
    sender,
    senderUserId: ctx.userId,
    message,
    createdAt: new Date().toISOString(),
  };
  await db.insert(supportMessages).values(row);
  return row;
}
