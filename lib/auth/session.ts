import type { KVNamespace } from "@cloudflare/workers-types";

const PREFIX = "sess:";
const TTL_SECONDS = 60 * 60 * 24 * 30;

export type SessionData = {
  userId: string;
  scope: "portal" | "admin";
  createdAt: string;
};

export async function createSession(kv: KVNamespace, data: { userId: string; scope: "portal" | "admin" }): Promise<string> {
  const id = crypto.randomUUID();
  const value: SessionData = { ...data, createdAt: new Date().toISOString() };
  await kv.put(PREFIX + id, JSON.stringify(value), { expirationTtl: TTL_SECONDS });
  return id;
}

export async function getSession(kv: KVNamespace, id: string): Promise<SessionData | null> {
  if (!id) return null;
  const raw = await kv.get(PREFIX + id);
  return raw ? (JSON.parse(raw) as SessionData) : null;
}

export async function destroySession(kv: KVNamespace, id: string): Promise<void> {
  if (id) await kv.delete(PREFIX + id);
}

export const SESSION_TTL_SECONDS = TTL_SECONDS;
