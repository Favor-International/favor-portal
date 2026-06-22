import { getR2Object } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const objectKey = key.join("/");

  const obj = await getR2Object(objectKey);
  if (!obj) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(obj.body as unknown as BodyInit, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
