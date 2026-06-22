import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { getStreamUrl, getThumbnailUrl } from "@/lib/cloudflare/client";
import { logAdminAudit } from "@/lib/admin/audit";

export const runtime = "nodejs";

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

export async function POST(request: Request) {
  try {
    const auth = await adminRoute("lms:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      return NextResponse.json(
        { error: "Cloudflare Stream credentials are not configured" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file upload" }, { status: 400 });
    }

    const uploadForm = new FormData();
    uploadForm.append("file", file, file.name);

    const cloudflareResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
        body: uploadForm,
      }
    );

    const cloudflareJson = await cloudflareResponse.json();
    if (!cloudflareResponse.ok || !cloudflareJson?.success) {
      const errorMessage =
        cloudflareJson?.errors?.[0]?.message ||
        cloudflareJson?.error ||
        "Cloudflare upload failed";
      return NextResponse.json({ error: errorMessage }, { status: 502 });
    }

    const uid = cloudflareJson.result?.uid as string | undefined;
    if (!uid) {
      return NextResponse.json({ error: "Missing Stream asset id" }, { status: 502 });
    }

    await logAdminAudit(getDb(), {
      actorUserId: ctx.userId,
      action: "lms.upload.video.cloudflare",
      entityType: "course_module_asset",
      entityId: uid,
      details: {
        filename: file.name,
        size: file.size,
      },
    });

    return NextResponse.json(
      {
        success: true,
        cloudflareVideoId: uid,
        streamUrl: getStreamUrl(uid),
        thumbnailUrl: getThumbnailUrl(uid),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Cloudflare upload route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
