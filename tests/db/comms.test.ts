import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb, ctxFor, seedUser } from "./helpers";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  recordSendLog,
  listSendLogs,
} from "@/lib/db/access/comms";
import { AuthorizationError } from "@/lib/db/access/authz";

let db: ReturnType<typeof makeTestDb>;
const ctxPlain = ctxFor("plain");
const ctxContent = ctxFor("content", { roleKeys: ["content_manager"] });
const ctxAnalyst = ctxFor("analyst", { roleKeys: ["analyst"] });

beforeEach(async () => {
  db = makeTestDb();
  await seedUser(db, "plain");
  await seedUser(db, "content");
  await seedUser(db, "analyst");
});

describe("comms access (manager-gated)", () => {
  it("a plain user cannot create a template", async () => {
    // Denial: no content_manager/support_manager role and not admin.
    await expect(
      createTemplate(db, ctxPlain, { channel: "email", name: "Welcome", content: "Hi" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("a content manager can create and list templates", async () => {
    const created = await createTemplate(db, ctxContent, {
      channel: "email",
      name: "Welcome",
      subject: "Hello",
      content: "Hi there",
    });
    expect(created.id).toBeTruthy();
    expect(created.createdBy).toBe("content");
    expect(created.updatedBy).toBe("content");

    const list = await listTemplates(db, ctxContent);
    expect(list.map((t) => t.id)).toContain(created.id);
  });

  it("a content manager can update and delete a template", async () => {
    const created = await createTemplate(db, ctxContent, { channel: "sms", name: "Reminder", content: "ping" });
    await updateTemplate(db, ctxContent, created.id, { name: "Reminder v2", status: "active" });
    const after = await listTemplates(db, ctxContent);
    const updated = after.find((t) => t.id === created.id);
    expect(updated?.name).toBe("Reminder v2");
    expect(updated?.status).toBe("active");
    expect(updated?.updatedBy).toBe("content");

    await deleteTemplate(db, ctxContent, created.id);
    expect((await listTemplates(db, ctxContent)).map((t) => t.id)).not.toContain(created.id);
  });

  it("a plain user cannot list templates", async () => {
    // Denial: read of templates is manager-gated too.
    await expect(listTemplates(db, ctxPlain)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("a plain user cannot record a send log", async () => {
    // Denial: recording a send is manager-gated.
    await expect(
      recordSendLog(db, ctxPlain, { templateName: "Welcome", channel: "email" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("a content manager can record a send log and an analyst can list send logs", async () => {
    const log = await recordSendLog(db, ctxContent, {
      templateName: "Welcome",
      channel: "email",
      recipient: "a@example.com",
    });
    expect(log.sentBy).toBe("content");

    // analyst is in the viewer set even though they cannot record.
    const logs = await listSendLogs(db, ctxAnalyst);
    expect(logs.map((l) => l.id)).toContain(log.id);
  });

  it("a plain user cannot list send logs", async () => {
    // Denial: analyst/content_manager/support_manager required to read logs.
    await expect(listSendLogs(db, ctxPlain)).rejects.toBeInstanceOf(AuthorizationError);
  });
});
