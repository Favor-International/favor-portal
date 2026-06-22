import type { KVNamespace } from "@cloudflare/workers-types";

const PREFIX = "ml:";
const TTL_SECONDS = 15 * 60;

export type MagicLinkPayload = {
  email: string;
  scope: "portal" | "admin";
  redirectTo: string;
};

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Generate a single-use magic-link token. Only its SHA-256 hash is stored in KV.
export async function createMagicLinkToken(kv: KVNamespace, payload: MagicLinkPayload): Promise<string> {
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const key = PREFIX + (await sha256Hex(token));
  await kv.put(key, JSON.stringify(payload), { expirationTtl: TTL_SECONDS });
  return token;
}

// Validate + consume a token (single-use: deleted on read).
export async function consumeMagicLinkToken(kv: KVNamespace, token: string): Promise<MagicLinkPayload | null> {
  if (!token) return null;
  const key = PREFIX + (await sha256Hex(token));
  const raw = await kv.get(key);
  if (!raw) return null;
  await kv.delete(key);
  return JSON.parse(raw) as MagicLinkPayload;
}
