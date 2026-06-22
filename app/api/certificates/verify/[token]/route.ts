import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { getCertificateByToken } from "@/lib/db/access/learning";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ valid: false, error: "Missing token" }, { status: 400 });
    }

    const data = await getCertificateByToken(getDb(), token);

    if (!data) {
      return NextResponse.json({ valid: false, error: "Certificate not found" }, { status: 404 });
    }

    const metadata =
      data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
        ? (data.metadata as Record<string, unknown>)
        : {};

    return NextResponse.json(
      {
        valid: true,
        issuedAt: data.issuedAt,
        completionRate: data.completionRate,
        certificateUrl: data.certificateUrl,
        certificateNumber: data.certificateNumber,
        recipientName:
          typeof metadata["recipientName"] === "string"
            ? (metadata["recipientName"] as string)
            : "Favor Partner",
        courseTitle:
          typeof metadata["courseTitle"] === "string"
            ? (metadata["courseTitle"] as string)
            : "Course",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Certificate verify route error:", error);
    return NextResponse.json({ valid: false, error: "Internal server error" }, { status: 500 });
  }
}
