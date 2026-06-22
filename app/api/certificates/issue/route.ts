import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { and, eq, inArray } from "drizzle-orm";
// TODO(Plan 5): replace Supabase Storage with R2
import { createClient } from "@/lib/supabase/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { issueCertificate } from "@/lib/db/access/learning";
import {
  courses,
  courseModules,
  userCourseProgress,
  userCourseCertificates,
  users,
} from "@/lib/db/schema";

export const runtime = "nodejs";

const CERTIFICATES_BUCKET = process.env.SUPABASE_CERTIFICATES_BUCKET || "lms-certificates";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

interface IssueCertificateBody {
  courseId?: string;
}

function buildVerificationUrl(token: string): string {
  if (APP_URL) {
    return `${APP_URL.replace(/\/+$/, "")}/certificates/${token}`;
  }
  return `/certificates/${token}`;
}

function buildCertificateNumber(): string {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(
    now.getUTCDate()
  ).padStart(2, "0")}`;
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `FAV-${stamp}-${rand}`;
}

async function generateCertificatePdf(params: {
  recipientName: string;
  courseTitle: string;
  issuedAt: string;
  certificateNumber: string;
  verificationUrl: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]);
  const serif = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({
    x: 24,
    y: 24,
    width: 794,
    height: 547,
    borderColor: rgb(0.17, 0.3, 0.14),
    borderWidth: 3,
    color: rgb(0.98, 0.97, 0.94),
  });

  page.drawText("FAVOR INTERNATIONAL", {
    x: 315,
    y: 525,
    size: 12,
    font: sans,
    color: rgb(0.17, 0.3, 0.14),
  });

  page.drawText("Certificate of Completion", {
    x: 245,
    y: 470,
    size: 36,
    font: serif,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText("This certifies that", {
    x: 360,
    y: 430,
    size: 14,
    font: sans,
    color: rgb(0.3, 0.3, 0.3),
  });

  page.drawText(params.recipientName, {
    x: 250,
    y: 385,
    size: 34,
    font: serif,
    color: rgb(0.17, 0.3, 0.14),
  });

  page.drawText("has successfully completed", {
    x: 330,
    y: 348,
    size: 14,
    font: sans,
    color: rgb(0.3, 0.3, 0.3),
  });

  page.drawText(params.courseTitle, {
    x: 220,
    y: 305,
    size: 24,
    font: serif,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText(`Issued ${new Date(params.issuedAt).toLocaleDateString()}`, {
    x: 325,
    y: 245,
    size: 12,
    font: sans,
    color: rgb(0.3, 0.3, 0.3),
  });

  page.drawText(`Certificate #${params.certificateNumber}`, {
    x: 70,
    y: 90,
    size: 10,
    font: sans,
    color: rgb(0.3, 0.3, 0.3),
  });

  page.drawText(`Verify: ${params.verificationUrl}`, {
    x: 70,
    y: 72,
    size: 10,
    font: sans,
    color: rgb(0.3, 0.3, 0.3),
  });

  return await doc.save();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IssueCertificateBody;
    const courseId = body.courseId;

    if (!courseId) {
      return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const userId = ctx.userId;
    const db = getDb();

    const [courseRow, userRow] = await Promise.all([
      db.select({ id: courses.id, title: courses.title }).from(courses).where(eq(courses.id, courseId)).get(),
      db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, userId))
        .get(),
    ]);

    if (!courseRow) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (!userRow) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const moduleRows = await db
      .select({ id: courseModules.id })
      .from(courseModules)
      .where(eq(courseModules.courseId, courseId))
      .all();

    const moduleIds = moduleRows.map((module) => module.id);
    if (moduleIds.length === 0) {
      return NextResponse.json({ error: "Course has no modules" }, { status: 400 });
    }

    const completedRows = await db
      .select({ moduleId: userCourseProgress.moduleId })
      .from(userCourseProgress)
      .where(
        and(
          eq(userCourseProgress.userId, userId),
          inArray(userCourseProgress.moduleId, moduleIds),
          eq(userCourseProgress.completed, true)
        )
      )
      .all();

    const completedModuleIds = new Set(completedRows.map((entry) => entry.moduleId));
    const isComplete = moduleIds.every((moduleId) => completedModuleIds.has(moduleId));

    if (!isComplete) {
      return NextResponse.json(
        { error: "Course must be fully completed before issuing certificate" },
        { status: 400 }
      );
    }

    const existingCertificate = await db
      .select({
        issuedAt: userCourseCertificates.issuedAt,
        certificateUrl: userCourseCertificates.certificateUrl,
        verificationToken: userCourseCertificates.verificationToken,
        certificateNumber: userCourseCertificates.certificateNumber,
      })
      .from(userCourseCertificates)
      .where(
        and(eq(userCourseCertificates.userId, userId), eq(userCourseCertificates.courseId, courseId))
      )
      .get();

    if (existingCertificate?.verificationToken && existingCertificate.certificateUrl) {
      const verificationUrl = buildVerificationUrl(existingCertificate.verificationToken);
      return NextResponse.json(
        {
          success: true,
          issuedAt: existingCertificate.issuedAt,
          certificateUrl: existingCertificate.certificateUrl,
          verificationUrl,
          certificateNumber: existingCertificate.certificateNumber,
        },
        { status: 200 }
      );
    }

    const issuedAt = new Date().toISOString();
    const verificationToken = crypto.randomBytes(20).toString("hex");
    const verificationUrl = buildVerificationUrl(verificationToken);
    const certificateNumber = existingCertificate?.certificateNumber || buildCertificateNumber();
    const recipientName = `${userRow.firstName} ${userRow.lastName}`.trim();
    const pdfBytes = await generateCertificatePdf({
      recipientName,
      courseTitle: courseRow.title,
      issuedAt,
      certificateNumber,
      verificationUrl,
    });

    // TODO(Plan 5): replace Supabase Storage with R2
    const supabase = await createClient();
    const filePath = `${userId}/${courseId}/${verificationToken}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(CERTIFICATES_BUCKET)
      .upload(filePath, pdfBytes, {
        upsert: true,
        contentType: "application/pdf",
      });

    let certificateUrl: string;
    if (uploadError || !uploadData?.path) {
      const base64 = Buffer.from(pdfBytes).toString("base64");
      certificateUrl = `data:application/pdf;base64,${base64}`;
    } else {
      const { data: publicUrlData } = supabase.storage
        .from(CERTIFICATES_BUCKET)
        .getPublicUrl(uploadData.path);
      certificateUrl = publicUrlData.publicUrl;
    }

    await issueCertificate(db, ctx, {
      courseId,
      completionRate: 100,
      certificateUrl,
      verificationToken,
      certificateNumber,
    });

    return NextResponse.json(
      {
        success: true,
        issuedAt,
        certificateUrl,
        verificationUrl,
        certificateNumber,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Issue certificate route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
