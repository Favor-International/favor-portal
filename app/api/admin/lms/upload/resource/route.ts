import { NextResponse } from "next/server";
import { putR2Object, r2PublicPath } from "@/lib/storage/r2";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { logAdminAudit } from "@/lib/admin/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await adminRoute("lms:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;
    const db = getDb();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file upload" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const key = `lms-resources/${ctx.userId}/${Date.now()}-${file.name}`;
    await putR2Object(key, bytes, file.type || undefined);
    const publicUrl = r2PublicPath(key);

    await logAdminAudit(db, {
      actorUserId: ctx.userId,
      action: "lms.upload.resource.storage",
      entityType: "course_module_asset",
      entityId: key,
      details: {
        filename: file.name,
        size: file.size,
      },
    });

    return NextResponse.json(
      {
        success: true,
        url: publicUrl,
        path: key,
        mode: "storage",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Resource upload route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
