import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb, ctxFor, seedUser } from "./helpers";
import {
  createTicket,
  listMyTickets,
  listAllTickets,
  getTicket,
  updateTicketStatus,
  listMessages,
  addMessage,
} from "@/lib/db/access/support";
import { AuthorizationError } from "@/lib/db/access/authz";

let db: ReturnType<typeof makeTestDb>;
const ctxA = ctxFor("userA");
const ctxB = ctxFor("userB");
const ctxManager = ctxFor("mgr", { roleKeys: ["support_manager"] });

beforeEach(async () => {
  db = makeTestDb();
  await seedUser(db, "userA");
  await seedUser(db, "userB");
  await seedUser(db, "mgr");
});

describe("support access (owner-scoped + manager-gated)", () => {
  it("listMyTickets is per-user", async () => {
    await createTicket(db, ctxA, { category: "billing", subject: "A1", message: "help A" });
    await createTicket(db, ctxB, { category: "billing", subject: "B1", message: "help B" });
    const a = await listMyTickets(db, ctxA);
    expect(a).toHaveLength(1);
    expect(a[0].subject).toBe("A1");
    const b = await listMyTickets(db, ctxB);
    expect(b).toHaveLength(1);
    expect(b[0].subject).toBe("B1");
  });

  it("a user cannot getTicket on another user's ticket", async () => {
    const t = await createTicket(db, ctxA, { category: "billing", subject: "A1", message: "help A" });
    // Denial: userB neither owns the ticket nor holds a viewer role.
    await expect(getTicket(db, ctxB, t.id)).rejects.toBeInstanceOf(AuthorizationError);
    // Owner can still read their own ticket.
    expect((await getTicket(db, ctxA, t.id))?.id).toBe(t.id);
  });

  it("a non-manager cannot list all tickets", async () => {
    await createTicket(db, ctxA, { category: "billing", subject: "A1", message: "help A" });
    // Denial: userA has no support_manager/analyst role.
    await expect(listAllTickets(db, ctxA)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("a support manager can getTicket and updateTicketStatus", async () => {
    const t = await createTicket(db, ctxA, { category: "billing", subject: "A1", message: "help A" });
    expect((await getTicket(db, ctxManager, t.id))?.id).toBe(t.id);
    const all = await listAllTickets(db, ctxManager);
    expect(all.map((x) => x.id)).toContain(t.id);

    await updateTicketStatus(db, ctxManager, t.id, "resolved");
    const resolved = await getTicket(db, ctxManager, t.id);
    expect(resolved?.status).toBe("resolved");
    expect(resolved?.resolvedAt).not.toBeNull();
  });

  it("a non-manager cannot update ticket status", async () => {
    const t = await createTicket(db, ctxA, { category: "billing", subject: "A1", message: "help A" });
    // Denial: even the owner cannot change status without a manager role.
    await expect(updateTicketStatus(db, ctxA, t.id, "resolved")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("the owner can addMessage (sender 'partner') to their own ticket", async () => {
    const t = await createTicket(db, ctxA, { category: "billing", subject: "A1", message: "help A" });
    const msg = await addMessage(db, ctxA, t.id, "any update?");
    expect(msg.sender).toBe("partner");
    expect(msg.senderUserId).toBe("userA");
    const msgs = await listMessages(db, ctxA, t.id);
    expect(msgs).toHaveLength(1);
  });

  it("a support manager addMessage is recorded as sender 'staff'", async () => {
    const t = await createTicket(db, ctxA, { category: "billing", subject: "A1", message: "help A" });
    const msg = await addMessage(db, ctxManager, t.id, "looking into it");
    expect(msg.sender).toBe("staff");
    expect(msg.senderUserId).toBe("mgr");
    // The owner can read the staff reply on their own ticket.
    expect(await listMessages(db, ctxA, t.id)).toHaveLength(1);
  });

  it("a user cannot addMessage to another user's ticket", async () => {
    const t = await createTicket(db, ctxA, { category: "billing", subject: "A1", message: "help A" });
    // Denial: userB is neither owner nor manager.
    await expect(addMessage(db, ctxB, t.id, "sneaky")).rejects.toBeInstanceOf(AuthorizationError);
    // And cannot enumerate the messages either.
    await expect(listMessages(db, ctxB, t.id)).rejects.toBeInstanceOf(AuthorizationError);
  });
});
