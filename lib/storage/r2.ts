import { getCloudflareContext } from "@opennextjs/cloudflare";

// Thin wrapper over the R2 bucket binding. Objects are served back via the
// /api/files/[...key] route (see app/api/files), so callers store a key and
// reference `/api/files/<key>` as the public URL.
export async function putR2Object(
  key: string,
  data: ArrayBuffer | ArrayBufferView | string,
  contentType?: string,
): Promise<string> {
  const { env } = getCloudflareContext();
  await env.R2.put(key, data, contentType ? { httpMetadata: { contentType } } : undefined);
  return key;
}

export async function getR2Object(key: string) {
  const { env } = getCloudflareContext();
  return env.R2.get(key);
}

export async function deleteR2Object(key: string): Promise<void> {
  const { env } = getCloudflareContext();
  await env.R2.delete(key);
}

export function r2PublicPath(key: string): string {
  return `/api/files/${key}`;
}
