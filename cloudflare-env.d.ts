// Cloudflare binding types for `getCloudflareContext().env`.
//
// Hand-maintained in MODULE form (note the `import`/`export {}`) so it only adds the
// global `CloudflareEnv` interface — it does NOT pull in the Workers runtime globals.
// `wrangler types` would regenerate this file with those runtime types, which override
// the DOM lib (e.g. `Response.json()` -> `unknown`) and break the existing app code.
//
// To add a binding: declare it in wrangler.jsonc AND add it here.
import type { D1Database, KVNamespace, R2Bucket, Fetcher } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    SESSIONS: KVNamespace;
    RATE_LIMIT: KVNamespace;
    R2: R2Bucket;
    ASSETS: Fetcher;
  }
}

export {};
