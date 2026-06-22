import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { getNote, upsertNote } from "@/lib/db/access/learning";

export const runtime = "nodejs";

interface UpsertNoteBody {
  moduleId?: string;
  content?: string;
}

export async function GET(request: Request) {
  try {
    const moduleId = new URL(request.url).searchParams.get("moduleId");
    if (!moduleId) {
      return NextResponse.json({ error: "Missing moduleId" }, { status: 400 });
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const note = await getNote(getDb(), ctx, moduleId);

    return NextResponse.json({ success: true, note }, { status: 200 });
  } catch (error) {
    console.error("LMS notes GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as UpsertNoteBody;
    if (!body.moduleId) {
      return NextResponse.json({ error: "Missing moduleId" }, { status: 400 });
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const note = await upsertNote(getDb(), ctx, body.moduleId, body.content ?? "");

    return NextResponse.json({ success: true, note }, { status: 200 });
  } catch (error) {
    console.error("LMS notes PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
