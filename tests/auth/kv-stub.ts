import type { KVNamespace } from "@cloudflare/workers-types";

// Minimal in-memory KVNamespace for unit tests (get/put-with-TTL/delete).
export function makeKv() {
  const store = new Map<string, { value: string; expireAt: number | null }>();
  return {
    async get(key: string) {
      const e = store.get(key);
      if (!e) return null;
      if (e.expireAt !== null && e.expireAt <= Date.now()) {
        store.delete(key);
        return null;
      }
      return e.value;
    },
    async put(key: string, value: string, opts?: { expirationTtl?: number }) {
      store.set(key, {
        value,
        expireAt: opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : null,
      });
    },
    async delete(key: string) {
      store.delete(key);
    },
    _store: store,
  } as unknown as KVNamespace;
}
