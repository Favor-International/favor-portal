import type { KVNamespace } from "@cloudflare/workers-types";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { fetchGivingHistoryByEmail, type GatewayHistory } from "@/lib/blackbaud/gateway";

// Per-user giving snapshot cache.
//
// Blackbaud's Standard APIs are rate-limited (1,000 calls / 24h). Without a
// cache, every dashboard view cost ~4 calls (history + recurring, each doing a
// constituent search + gift list). This caches the FULL gateway response
// (gifts + recurring schedules + summary) once per user and serves both the
// history and recurring surfaces from it.
//
// Freshness model, matching "pull the latest whenever someone logs in":
//   - A snapshot is valid only if it was fetched AFTER the user's last login
//     (lastLogin is stamped on every magic-link / password sign-in) AND within
//     the TTL. So the first data load after any login always refetches, and an
//     active session refreshes at most every TTL window.
//   - Mutations (change amount / pause / cancel) force-refresh so the change
//     is reflected immediately.

const TTL_MS = 15 * 60 * 1000; // in-session refresh cadence
const KV_TTL_SECONDS = 60 * 60; // hard KV expiry

interface Snapshot {
  fetchedAt: number;
  data: GatewayHistory;
}

function kv(): KVNamespace | null {
  try {
    return getCloudflareContext().env.SESSIONS as unknown as KVNamespace;
  } catch {
    return null;
  }
}

const keyFor = (userId: string) => `giving:snap:${userId}`;

interface SnapshotOpts {
  /** ISO string; a cached snapshot older than this (e.g. the user's lastLogin) is stale. */
  notBefore?: string | null;
  /** Bypass the cache and refetch from Blackbaud. */
  force?: boolean;
}

export async function getGivingSnapshot(
  userId: string,
  email: string,
  opts: SnapshotOpts = {}
): Promise<GatewayHistory | null> {
  const store = kv();
  const notBeforeMs = opts.notBefore ? Date.parse(opts.notBefore) : NaN;

  if (store && !opts.force) {
    const raw = await store.get(keyFor(userId));
    if (raw) {
      try {
        const snap = JSON.parse(raw) as Snapshot;
        const withinTtl = Date.now() - snap.fetchedAt < TTL_MS;
        const afterLogin = Number.isNaN(notBeforeMs) || snap.fetchedAt >= notBeforeMs;
        if (withinTtl && afterLogin) return snap.data;
      } catch {
        /* corrupt entry — refetch below */
      }
    }
  }

  const data = await fetchGivingHistoryByEmail(email);
  if (data && store) {
    const snap: Snapshot = { fetchedAt: Date.now(), data };
    await store.put(keyFor(userId), JSON.stringify(snap), { expirationTtl: KV_TTL_SECONDS });
  }
  return data;
}

export async function refreshGivingSnapshot(userId: string, email: string): Promise<GatewayHistory | null> {
  return getGivingSnapshot(userId, email, { force: true });
}
